/**
 * Safe expression parser using a Pratt (precedence-climbing) parser.
 *
 * NO eval, NO new Function, NO dynamic code execution.
 * Parses user text into an AST, then provides:
 * - Symbolic differentiation over that AST
 * - Evaluation via closures
 * - LaTeX output for KaTeX rendering
 *
 * Guards:
 * - Max 200 characters input
 * - Max 200 AST nodes
 * - Whitelist-only functions (sin, cos, tan, exp, log, ln, sqrt, abs, asin, acos, atan, sinh, cosh, tanh)
 * - Exponent magnitude <= 100
 * - Must depend on variable x
 * - No nested powers in exponents
 */

// ============================================================================
// AST Node Types
// ============================================================================

export type ASTNode =
  | { type: 'number'; value: number }
  | { type: 'variable' }  // always 'x'
  | { type: 'constant'; name: 'pi' | 'e' }
  | { type: 'unary'; op: '+' | '-'; operand: ASTNode }
  | { type: 'binary'; op: '+' | '-' | '*' | '/'; left: ASTNode; right: ASTNode }
  | { type: 'power'; base: ASTNode; exponent: ASTNode }
  | { type: 'call'; fn: WhitelistFn; arg: ASTNode };

export type WhitelistFn =
  | 'sin' | 'cos' | 'tan' | 'exp' | 'log' | 'ln' | 'sqrt' | 'abs'
  | 'asin' | 'acos' | 'atan' | 'sinh' | 'cosh' | 'tanh';

const WHITELIST_FNS = new Set<string>([
  'sin', 'cos', 'tan', 'exp', 'log', 'ln', 'sqrt', 'abs',
  'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh',
]);

// ============================================================================
// Error Classes
// ============================================================================

export class ExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExpressionError';
  }
}

// ============================================================================
// Tokenizer
// ============================================================================

type TokenType =
  | 'number' | 'ident' | 'plus' | 'minus' | 'star' | 'slash'
  | 'caret' | 'lparen' | 'rparen' | 'eof';

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

const SUPERSCRIPT_MAP: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '-',
  'ᵃ': 'a', 'ᵇ': 'b', 'ᶜ': 'c', 'ᵈ': 'd', 'ᵉ': 'e',
  'ᶠ': 'f', 'ᵍ': 'g', 'ʰ': 'h', 'ⁱ': 'i', 'ʲ': 'j',
  'ᵏ': 'k', 'ˡ': 'l', 'ᵐ': 'm', 'ⁿ': 'n', 'ᵒ': 'o',
  'ᵖ': 'p', 'ʳ': 'r', 'ˢ': 's', 'ᵗ': 't', 'ᵘ': 'u',
  'ᵛ': 'v', 'ʷ': 'w', 'ˣ': 'x', 'ʸ': 'y', 'ᶻ': 'z',
};

const SUPERSCRIPT_RE = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻ]+/g;

function preprocess(input: string): string {
  let s = input.trim();

  // Unicode minus signs and multiplication symbols
  s = s.replace(/\u2212/g, '-').replace(/\u2013/g, '-').replace(/\u2014/g, '-');
  s = s.replace(/\u00d7/g, '*').replace(/\u22c5/g, '*').replace(/\u00b7/g, '*');

  // Replace unicode superscripts (e.g. x² -> x**(2))
  s = s.replace(SUPERSCRIPT_RE, (m) => {
    const content = Array.from(m).map(c => SUPERSCRIPT_MAP[c] ?? c).join('');
    return `**(${content})`;
  });

  // ^ -> **
  s = s.replace(/\^/g, '**');

  // Implicit multiplication
  const fnPattern = '(?:sin|cos|tan|exp|log|ln|sqrt|abs|asin|acos|atan|sinh|cosh|tanh|pi)\\b';
  // Number before x, (, or known function
  s = s.replace(new RegExp(`(?<=[0-9])\\s*(?=[xX]|\\(|${fnPattern})`, 'g'), '*');
  // ) before (, x, or known function
  s = s.replace(new RegExp(`(?<=\\))\\s*(?=\\(|[xX]|${fnPattern})`, 'g'), '*');
  // x before (
  s = s.replace(/(?<=[xX])\s*(?=\()/g, '*');

  return s;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i]!;

    // Skip whitespace
    if (/\s/.test(ch)) { i++; continue; }

    // Number (including scientific notation like 1e-3)
    if (/[0-9.]/.test(ch)) {
      let num = '';
      const start = i;
      while (i < input.length && /[0-9.]/.test(input[i]!)) {
        num += input[i]!;
        i++;
      }
      // Check for scientific notation: e or E followed by optional +/- and digits
      if (i < input.length && (input[i] === 'e' || input[i] === 'E')) {
        const nextIdx = i + 1;
        if (nextIdx < input.length && (/[0-9]/.test(input[nextIdx]!) ||
            ((input[nextIdx] === '+' || input[nextIdx] === '-') && nextIdx + 1 < input.length && /[0-9]/.test(input[nextIdx + 1]!)))) {
          num += input[i]!; // 'e' or 'E'
          i++;
          if (input[i] === '+' || input[i] === '-') {
            num += input[i]!;
            i++;
          }
          while (i < input.length && /[0-9]/.test(input[i]!)) {
            num += input[i]!;
            i++;
          }
        }
      }
      tokens.push({ type: 'number', value: num, pos: start });
      continue;
    }

    // Identifier (variable, constant, function name)
    if (/[a-zA-Z_]/.test(ch)) {
      let name = '';
      const start = i;
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i]!)) {
        name += input[i]!;
        i++;
      }
      tokens.push({ type: 'ident', value: name, pos: start });
      continue;
    }

    // Operators and punctuation
    if (ch === '+') { tokens.push({ type: 'plus', value: '+', pos: i }); i++; continue; }
    if (ch === '-') { tokens.push({ type: 'minus', value: '-', pos: i }); i++; continue; }
    if (ch === '/') { tokens.push({ type: 'slash', value: '/', pos: i }); i++; continue; }
    if (ch === '(') { tokens.push({ type: 'lparen', value: '(', pos: i }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'rparen', value: ')', pos: i }); i++; continue; }

    // ** (power) or * (multiply)
    if (ch === '*') {
      if (i + 1 < input.length && input[i + 1] === '*') {
        tokens.push({ type: 'caret', value: '**', pos: i });
        i += 2;
      } else {
        tokens.push({ type: 'star', value: '*', pos: i });
        i++;
      }
      continue;
    }

    throw new ExpressionError(
      `Unexpected character '${ch}' at position ${i}. Only mathematical expressions are allowed.`
    );
  }

  tokens.push({ type: 'eof', value: '', pos: i });
  return tokens;
}

// ============================================================================
// Pratt Parser (Precedence Climbing)
// ============================================================================

class Parser {
  private tokens: Token[];
  private pos: number;
  private nodeCount: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
    this.nodeCount = 0;
  }

  private peek(): Token {
    return this.tokens[this.pos]!;
  }

  private advance(): Token {
    const t = this.tokens[this.pos]!;
    this.pos++;
    return t;
  }

  private expect(type: TokenType): Token {
    const t = this.peek();
    if (t.type !== type) {
      throw new ExpressionError(
        `Expected ${type} but found '${t.value}' at position ${t.pos}. Check for unmatched parentheses or misplaced operators.`
      );
    }
    return this.advance();
  }

  private countNode(): void {
    this.nodeCount++;
    if (this.nodeCount > 200) {
      throw new ExpressionError('Expression is too complex (exceeds AST node limit of 200).');
    }
  }

  parse(): ASTNode {
    const node = this.parseExpr(0);
    if (this.peek().type !== 'eof') {
      throw new ExpressionError(
        `Unexpected token '${this.peek().value}' at position ${this.peek().pos}. Check for unmatched parentheses or misplaced operators.`
      );
    }
    return node;
  }

  private parseExpr(minPrec: number): ASTNode {
    let left = this.parsePrefix();

    while (true) {
      const t = this.peek();
      const prec = this.infixPrec(t);
      if (prec < minPrec) break;

      if (t.type === 'caret') {
        this.advance();
        this.countNode();
        const right = this.parseExpr(prec); // right-associative
        this.checkExponent(right);
        this.checkConstantPower(left, right);
        left = { type: 'power', base: left, exponent: right };
      } else if (t.type === 'plus' || t.type === 'minus') {
        const op = this.advance().value as '+' | '-';
        this.countNode();
        const right = this.parseExpr(prec + 1);
        left = { type: 'binary', op, left, right };
      } else if (t.type === 'star') {
        this.advance();
        this.countNode();
        const right = this.parseExpr(prec + 1);
        left = { type: 'binary', op: '*', left, right };
      } else if (t.type === 'slash') {
        this.advance();
        this.countNode();
        const right = this.parseExpr(prec + 1);
        left = { type: 'binary', op: '/', left, right };
      } else {
        break;
      }
    }

    return left;
  }

  private infixPrec(t: Token): number {
    switch (t.type) {
      case 'plus':
      case 'minus':
        return 1;
      case 'star':
      case 'slash':
        return 2;
      case 'caret':
        return 3;
      default:
        return -1;
    }
  }

  private parsePrefix(): ASTNode {
    const t = this.peek();

    if (t.type === 'number') {
      this.advance();
      this.countNode();
      const val = parseFloat(t.value);
      if (!Number.isFinite(val)) {
        throw new ExpressionError(`Invalid number '${t.value}'.`);
      }
      return { type: 'number', value: val };
    }

    if (t.type === 'ident') {
      const name = this.advance().value.toLowerCase();

      // Check for function call
      if (this.peek().type === 'lparen' && WHITELIST_FNS.has(name)) {
        this.advance(); // consume (
        this.countNode();
        const arg = this.parseExpr(0);
        this.expect('rparen');
        return { type: 'call', fn: name as WhitelistFn, arg };
      }

      // Variable x
      if (name === 'x') {
        this.countNode();
        return { type: 'variable' };
      }

      // Constants
      if (name === 'pi') {
        this.countNode();
        return { type: 'constant', name: 'pi' };
      }
      if (name === 'e') {
        this.countNode();
        return { type: 'constant', name: 'e' };
      }

      // Unknown function call
      if (this.peek().type === 'lparen') {
        throw new ExpressionError(
          `Unknown function '${name}'. Supported functions: ${Array.from(WHITELIST_FNS).sort().join(', ')}.`
        );
      }

      throw new ExpressionError(
        `Unknown name '${name}'. Use the variable x, constants pi and e, and functions ` +
        'such as sin, cos, tan, exp, log, ln, sqrt, abs, asin, acos, atan, sinh, cosh, tanh.'
      );
    }

    if (t.type === 'lparen') {
      this.advance();
      this.countNode();
      const inner = this.parseExpr(0);
      this.expect('rparen');
      return inner;
    }

    if (t.type === 'plus') {
      this.advance();
      this.countNode();
      const operand = this.parsePrefix();
      return { type: 'unary', op: '+', operand };
    }

    if (t.type === 'minus') {
      this.advance();
      this.countNode();
      const operand = this.parsePrefix();
      return { type: 'unary', op: '-', operand };
    }

    throw new ExpressionError(
      `Invalid expression syntax. Unexpected '${t.value}' at position ${t.pos}. ` +
      'Please check for unmatched parentheses or misplaced operators.'
    );
  }

  private checkExponent(node: ASTNode): void {
    if (node.type === 'number') {
      if (Math.abs(node.value) > 100) {
        throw new ExpressionError(
          `Exponent magnitude ${node.value} exceeds maximum allowed limit (100).`
        );
      }
    }
    if (node.type === 'unary' && node.op === '-' && node.operand.type === 'number') {
      if (Math.abs(node.operand.value) > 100) {
        throw new ExpressionError('Exponent magnitude exceeds maximum allowed limit (100).');
      }
    }
    if (node.type === 'power') {
      throw new ExpressionError('Nested powers in exponents are not permitted.');
    }
  }

  private checkConstantPower(base: ASTNode, exp: ASTNode): void {
    if (base.type === 'number' && exp.type === 'number') {
      if (Math.abs(exp.value) > 100) {
        throw new ExpressionError('Exponent magnitude exceeds maximum allowed limit (100).');
      }
      try {
        const val = Math.abs(Math.pow(base.value, exp.value));
        if (val > 1e100) {
          throw new ExpressionError('Constant exponentiation produces a number exceeding 1e100.');
        }
      } catch {
        throw new ExpressionError('Constant exponentiation overflow or error.');
      }
    }
  }
}

// ============================================================================
// Public Parse Function
// ============================================================================

export function parseExpression(text: string): ASTNode {
  if (!text || !text.trim()) {
    throw new ExpressionError('Please enter a function of x.');
  }

  const raw = text.trim();
  if (raw.length > 200) {
    throw new ExpressionError(
      `Expression is too long (${raw.length} characters). Maximum allowed is 200.`
    );
  }

  const clean = preprocess(raw);
  const tokens = tokenize(clean);
  const parser = new Parser(tokens);
  const ast = parser.parse();

  // Check that expression depends on x
  if (!containsVariable(ast)) {
    throw new ExpressionError("Expression must depend on the variable 'x'.");
  }

  return ast;
}

function containsVariable(node: ASTNode): boolean {
  switch (node.type) {
    case 'variable': return true;
    case 'number':
    case 'constant': return false;
    case 'unary': return containsVariable(node.operand);
    case 'binary': return containsVariable(node.left) || containsVariable(node.right);
    case 'power': return containsVariable(node.base) || containsVariable(node.exponent);
    case 'call': return containsVariable(node.arg);
  }
}

// ============================================================================
// Evaluator (closures, NO eval)
// ============================================================================

export function buildEvaluator(ast: ASTNode): (x: number) => number {
  switch (ast.type) {
    case 'number': {
      const v = ast.value;
      return () => v;
    }
    case 'variable':
      return (x) => x;
    case 'constant':
      if (ast.name === 'pi') return () => Math.PI;
      return () => Math.E;
    case 'unary': {
      const inner = buildEvaluator(ast.operand);
      if (ast.op === '+') return inner;
      return (x) => -inner(x);
    }
    case 'binary': {
      const l = buildEvaluator(ast.left);
      const r = buildEvaluator(ast.right);
      switch (ast.op) {
        case '+': return (x) => l(x) + r(x);
        case '-': return (x) => l(x) - r(x);
        case '*': return (x) => l(x) * r(x);
        case '/': return (x) => l(x) / r(x);
      }
      break; // unreachable but TS needs it
    }
    case 'power': {
      const b = buildEvaluator(ast.base);
      const e = buildEvaluator(ast.exponent);
      return (x) => Math.pow(b(x), e(x));
    }
    case 'call': {
      const arg = buildEvaluator(ast.arg);
      const fnMap: Record<WhitelistFn, (v: number) => number> = {
        sin: Math.sin, cos: Math.cos, tan: Math.tan,
        exp: Math.exp, log: Math.log, ln: Math.log,
        sqrt: Math.sqrt, abs: Math.abs,
        asin: Math.asin, acos: Math.acos, atan: Math.atan,
        sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
      };
      const fn = fnMap[ast.fn];
      return (x) => fn(arg(x));
    }
  }
  // Exhaustiveness check
  const _exhaustive: never = ast;
  throw new Error(`Unknown AST node type: ${(_exhaustive as ASTNode).type}`);
}

// ============================================================================
// Symbolic Differentiator (over AST)
// ============================================================================

export function differentiate(node: ASTNode): ASTNode {
  switch (node.type) {
    case 'number':
    case 'constant':
      return { type: 'number', value: 0 };

    case 'variable':
      return { type: 'number', value: 1 };

    case 'unary': {
      const dInner = differentiate(node.operand);
      if (node.op === '+') return dInner;
      return { type: 'unary', op: '-', operand: dInner };
    }

    case 'binary': {
      const dL = differentiate(node.left);
      const dR = differentiate(node.right);
      switch (node.op) {
        case '+':
          return { type: 'binary', op: '+', left: dL, right: dR };
        case '-':
          return { type: 'binary', op: '-', left: dL, right: dR };
        case '*':
          // Product rule: f'g + fg'
          return {
            type: 'binary', op: '+',
            left: { type: 'binary', op: '*', left: dL, right: node.right },
            right: { type: 'binary', op: '*', left: node.left, right: dR },
          };
        case '/':
          // Quotient rule: (f'g - fg') / g²
          return {
            type: 'binary', op: '/',
            left: {
              type: 'binary', op: '-',
              left: { type: 'binary', op: '*', left: dL, right: node.right },
              right: { type: 'binary', op: '*', left: node.left, right: dR },
            },
            right: {
              type: 'power', base: node.right,
              exponent: { type: 'number', value: 2 },
            },
          };
      }
      break;
    }

    case 'power': {
      const baseHasX = containsVariable(node.base);
      const expHasX = containsVariable(node.exponent);

      if (!expHasX) {
        // Power rule: n*f^(n-1)*f'
        const dBase = differentiate(node.base);
        return {
          type: 'binary', op: '*',
          left: {
            type: 'binary', op: '*',
            left: node.exponent,
            right: {
              type: 'power', base: node.base,
              exponent: {
                type: 'binary', op: '-',
                left: node.exponent,
                right: { type: 'number', value: 1 },
              },
            },
          },
          right: dBase,
        };
      }

      if (!baseHasX) {
        // a^g(x) = a^g * ln(a) * g'
        const dExp = differentiate(node.exponent);
        return {
          type: 'binary', op: '*',
          left: {
            type: 'binary', op: '*',
            left: node, // a^g(x)
            right: { type: 'call', fn: 'ln', arg: node.base },
          },
          right: dExp,
        };
      }

      // General case: f^g = e^(g*ln(f))
      // d/dx = f^g * (g' * ln(f) + g * f'/f)
      const dBase = differentiate(node.base);
      const dExp = differentiate(node.exponent);
      return {
        type: 'binary', op: '*',
        left: node,
        right: {
          type: 'binary', op: '+',
          left: {
            type: 'binary', op: '*',
            left: dExp,
            right: { type: 'call', fn: 'ln', arg: node.base },
          },
          right: {
            type: 'binary', op: '*',
            left: node.exponent,
            right: {
              type: 'binary', op: '/',
              left: dBase,
              right: node.base,
            },
          },
        },
      };
    }

    case 'call': {
      // Chain rule: d/dx f(g(x)) = f'(g(x)) * g'(x)
      const dArg = differentiate(node.arg);
      const outerDeriv = differentiateBuiltin(node.fn, node.arg);
      return { type: 'binary', op: '*', left: outerDeriv, right: dArg };
    }
  }

  const _exhaustive: never = node;
  throw new Error(`Unknown AST node type: ${(_exhaustive as ASTNode).type}`);
}

function differentiateBuiltin(fn: WhitelistFn, arg: ASTNode): ASTNode {
  switch (fn) {
    case 'sin':
      return { type: 'call', fn: 'cos', arg };
    case 'cos':
      return { type: 'unary', op: '-', operand: { type: 'call', fn: 'sin', arg } };
    case 'tan':
      // 1/cos²(x)
      return {
        type: 'binary', op: '/',
        left: { type: 'number', value: 1 },
        right: { type: 'power', base: { type: 'call', fn: 'cos', arg }, exponent: { type: 'number', value: 2 } },
      };
    case 'exp':
      return { type: 'call', fn: 'exp', arg };
    case 'log':
    case 'ln':
      return { type: 'binary', op: '/', left: { type: 'number', value: 1 }, right: arg };
    case 'sqrt':
      // 1/(2*sqrt(x))
      return {
        type: 'binary', op: '/',
        left: { type: 'number', value: 1 },
        right: {
          type: 'binary', op: '*',
          left: { type: 'number', value: 2 },
          right: { type: 'call', fn: 'sqrt', arg },
        },
      };
    case 'abs':
      // x / |x|  (undefined at 0, but that's mathematically correct)
      return { type: 'binary', op: '/', left: arg, right: { type: 'call', fn: 'abs', arg } };
    case 'asin':
      // 1/sqrt(1-x²)
      return {
        type: 'binary', op: '/',
        left: { type: 'number', value: 1 },
        right: {
          type: 'call', fn: 'sqrt', arg: {
            type: 'binary', op: '-',
            left: { type: 'number', value: 1 },
            right: { type: 'power', base: arg, exponent: { type: 'number', value: 2 } },
          },
        },
      };
    case 'acos':
      // -1/sqrt(1-x²)
      return {
        type: 'unary', op: '-', operand: {
          type: 'binary', op: '/',
          left: { type: 'number', value: 1 },
          right: {
            type: 'call', fn: 'sqrt', arg: {
              type: 'binary', op: '-',
              left: { type: 'number', value: 1 },
              right: { type: 'power', base: arg, exponent: { type: 'number', value: 2 } },
            },
          },
        },
      };
    case 'atan':
      // 1/(1+x²)
      return {
        type: 'binary', op: '/',
        left: { type: 'number', value: 1 },
        right: {
          type: 'binary', op: '+',
          left: { type: 'number', value: 1 },
          right: { type: 'power', base: arg, exponent: { type: 'number', value: 2 } },
        },
      };
    case 'sinh':
      return { type: 'call', fn: 'cosh', arg };
    case 'cosh':
      return { type: 'call', fn: 'sinh', arg };
    case 'tanh':
      // 1 - tanh²(x)
      return {
        type: 'binary', op: '-',
        left: { type: 'number', value: 1 },
        right: { type: 'power', base: { type: 'call', fn: 'tanh', arg }, exponent: { type: 'number', value: 2 } },
      };
  }
}

// ============================================================================
// Simplifier (basic algebraic simplification for cleaner derivatives)
// ============================================================================

export function simplify(node: ASTNode): ASTNode {
  switch (node.type) {
    case 'number':
    case 'variable':
    case 'constant':
      return node;

    case 'unary': {
      const inner = simplify(node.operand);
      if (node.op === '+') return inner;
      if (inner.type === 'number') return { type: 'number', value: -inner.value };
      if (inner.type === 'unary' && inner.op === '-') return inner.operand;
      return { type: 'unary', op: '-', operand: inner };
    }

    case 'binary': {
      const l = simplify(node.left);
      const r = simplify(node.right);

      // Constant folding
      if (l.type === 'number' && r.type === 'number') {
        switch (node.op) {
          case '+': return { type: 'number', value: l.value + r.value };
          case '-': return { type: 'number', value: l.value - r.value };
          case '*': return { type: 'number', value: l.value * r.value };
          case '/': return r.value !== 0
            ? { type: 'number', value: l.value / r.value }
            : { type: 'binary', op: '/', left: l, right: r };
        }
      }

      // Additive identity
      if (node.op === '+') {
        if (l.type === 'number' && l.value === 0) return r;
        if (r.type === 'number' && r.value === 0) return l;
      }
      if (node.op === '-') {
        if (r.type === 'number' && r.value === 0) return l;
        if (l.type === 'number' && l.value === 0) return { type: 'unary', op: '-', operand: r };
      }

      // Multiplicative identity & zero
      if (node.op === '*') {
        if (l.type === 'number' && l.value === 0) return { type: 'number', value: 0 };
        if (r.type === 'number' && r.value === 0) return { type: 'number', value: 0 };
        if (l.type === 'number' && l.value === 1) return r;
        if (r.type === 'number' && r.value === 1) return l;
      }

      if (node.op === '/') {
        if (l.type === 'number' && l.value === 0) return { type: 'number', value: 0 };
        if (r.type === 'number' && r.value === 1) return l;
      }

      return { type: 'binary', op: node.op, left: l, right: r };
    }

    case 'power': {
      const b = simplify(node.base);
      const e = simplify(node.exponent);
      if (e.type === 'number' && e.value === 0) return { type: 'number', value: 1 };
      if (e.type === 'number' && e.value === 1) return b;
      if (b.type === 'number' && b.value === 0) return { type: 'number', value: 0 };
      if (b.type === 'number' && b.value === 1) return { type: 'number', value: 1 };
      if (b.type === 'number' && e.type === 'number') {
        const v = Math.pow(b.value, e.value);
        if (Number.isFinite(v) && Math.abs(v) <= 1e15) return { type: 'number', value: v };
      }
      return { type: 'power', base: b, exponent: e };
    }

    case 'call': {
      const a = simplify(node.arg);
      if (a.type === 'number') {
        const fnMap: Record<WhitelistFn, (v: number) => number> = {
          sin: Math.sin, cos: Math.cos, tan: Math.tan,
          exp: Math.exp, log: Math.log, ln: Math.log,
          sqrt: Math.sqrt, abs: Math.abs,
          asin: Math.asin, acos: Math.acos, atan: Math.atan,
          sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
        };
        const v = fnMap[node.fn](a.value);
        if (Number.isFinite(v)) return { type: 'number', value: v };
      }
      return { type: 'call', fn: node.fn, arg: a };
    }
  }

  const _exhaustive: never = node;
  throw new Error(`Unknown AST node type: ${(_exhaustive as ASTNode).type}`);
}

// ============================================================================
// LaTeX Renderer
// ============================================================================

export function astToLatex(node: ASTNode): string {
  switch (node.type) {
    case 'number': {
      if (Number.isInteger(node.value) && Math.abs(node.value) < 1e15) {
        return node.value.toString();
      }
      return formatLatexNumber(node.value);
    }
    case 'variable': return 'x';
    case 'constant':
      return node.name === 'pi' ? '\\pi' : 'e';
    case 'unary': {
      if (node.op === '-') {
        const inner = astToLatex(node.operand);
        return `-${wrapIfNeeded(node.operand, inner)}`;
      }
      return astToLatex(node.operand);
    }
    case 'binary': {
      const lStr = astToLatex(node.left);
      const rStr = astToLatex(node.right);
      switch (node.op) {
        case '+': return `${lStr} + ${rStr}`;
        case '-': return `${lStr} - ${wrapIfSum(node.right, rStr)}`;
        case '*': return `${wrapIfSum(node.left, lStr)} \\cdot ${wrapIfSum(node.right, rStr)}`;
        case '/': return `\\frac{${astToLatex(node.left)}}{${astToLatex(node.right)}}`;
      }
      break;
    }
    case 'power': {
      const baseStr = wrapBase(node.base);
      const expStr = astToLatex(node.exponent);
      return `${baseStr}^{${expStr}}`;
    }
    case 'call': {
      const fnName = node.fn === 'ln' ? '\\ln' :
        node.fn === 'sqrt' ? '' :
        node.fn === 'abs' ? '' :
        `\\${node.fn}`;
      const argStr = astToLatex(node.arg);
      if (node.fn === 'sqrt') return `\\sqrt{${argStr}}`;
      if (node.fn === 'abs') return `\\left|${argStr}\\right|`;
      return `${fnName}\\left(${argStr}\\right)`;
    }
  }
  return '';
}

function formatLatexNumber(val: number): string {
  if (Number.isInteger(val)) return val.toString();
  const s = val.toPrecision(6);
  if (s.includes('e')) {
    const [mantissa, exp] = s.split('e');
    return `${mantissa} \\times 10^{${parseInt(exp!, 10)}}`;
  }
  return s;
}

function wrapIfNeeded(node: ASTNode, str: string): string {
  if (node.type === 'binary' && (node.op === '+' || node.op === '-')) {
    return `\\left(${str}\\right)`;
  }
  return str;
}

function wrapIfSum(node: ASTNode, str: string): string {
  if (node.type === 'binary' && (node.op === '+' || node.op === '-')) {
    return `\\left(${str}\\right)`;
  }
  if (node.type === 'unary' && node.op === '-') {
    return `\\left(${str}\\right)`;
  }
  return str;
}

function wrapBase(node: ASTNode): string {
  const str = astToLatex(node);
  if (node.type === 'binary' || node.type === 'unary' || node.type === 'power') {
    return `\\left(${str}\\right)`;
  }
  if (node.type === 'call') return str;
  if (node.type === 'number' && (node.value < 0 || str.includes(' '))) {
    return `\\left(${str}\\right)`;
  }
  return str;
}
