/**
 * Design tokens for Newton-Raphson Visual Lab.
 *
 * Observatory Theme: Deep ink surfaces, hairline structure, luminous semantic geometry.
 * All text tokens satisfy WCAG AA contrast (>= 4.5:1) against ink-900 and ink-950.
 * Zero hard-coded colors exist outside this module.
 */

export const SURFACES = {
  ink_950: '#05080F',
  ink_900: '#0A1020',
  ink_850: '#0F1830',
  ink_800: '#16213D',
  line: '#22304F',
  grid_minor: '#111B33',
  grid_major: '#1A2745',
  panel_top_highlight: 'rgba(255, 255, 255, 0.05)',
  transparent: 'rgba(0, 0, 0, 0)',
  panel_backdrop: 'rgba(15, 24, 48, 0.85)',
  badge_bg: 'rgba(22, 33, 61, 0.85)',
} as const;

export const TEXT = {
  text_1: '#EEF3FC',
  text_2: '#A3B1CC',
  text_3: '#7585A8',
} as const;

export const SEMANTIC = {
  curve_aqua: '#2EE6D6',
  curve_azure: '#4DA3FF',
  curve_periwinkle: '#8F7BFF',
  curve_glow: 'rgba(77, 163, 255, 0.16)',
  curve_glow_outer: 'rgba(46, 230, 214, 0.06)',

  tangent: '#FFC247',
  tangent_history: 'rgba(255, 194, 71, 0.22)',
  tangent_halo: 'rgba(255, 194, 71, 0.14)',

  current_x: '#FF5C7A',
  current_x_history: 'rgba(255, 92, 122, 0.35)',
  current_x_core: '#FFA4B4',
  current_x_halo: 'rgba(255, 92, 122, 0.22)',

  next_x: '#B6F36B',
  next_x_history: 'rgba(182, 243, 107, 0.35)',
  next_x_core: '#E2FDC2',
  next_x_halo: 'rgba(182, 243, 107, 0.22)',

  root_core: '#FFFFFF',
  root_ring: '#B6F36B',
  root_halo: 'rgba(182, 243, 107, 0.28)',

  axis_x: '#C7D3EA',

  table_highlight: 'rgba(77, 163, 255, 0.22)',
  table_highlight_border: 'rgba(77, 163, 255, 0.45)',
  focus_ring: 'rgba(77, 163, 255, 0.40)',

  ambient_glow: 'rgba(46, 163, 255, 0.05)',
  vignette: 'rgba(5, 8, 15, 0.35)',
} as const;

export const UI_STATES = {
  primary: '#4DA3FF',
  success: '#6EE7A8',
  warning: '#FFC247',
  error: '#FF6B7F',
} as const;

export const FONTS = {
  display: "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace",
} as const;
