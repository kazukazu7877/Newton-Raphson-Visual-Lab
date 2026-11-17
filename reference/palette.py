"""Palette and visual token definitions for Newton-Raphson Visual Lab.

Observatory Theme: Deep ink surfaces, hairline structure, and luminous semantic geometry.
All text tokens strictly satisfy WCAG AA contrast (>= 4.5:1) against ink-900 and ink-950.
Zero hard-coded colors exist outside this module.
"""

from __future__ import annotations


# ============================================================================
# Color Tokens
# ============================================================================

SURFACES = {
    "ink_950": "#05080F",      # Page background (deep space void)
    "ink_900": "#0A1020",      # Plot/stage background
    "ink_850": "#0F1830",      # Panels and cards
    "ink_800": "#16213D",      # Raised elements / inputs / hovering
    "line": "#22304F",         # Hairlines and borders
    "grid_minor": "#111B33",   # Minor grid lines (barely visible)
    "grid_major": "#1A2745",   # Major grid lines
    "panel_top_highlight": "rgba(255, 255, 255, 0.05)",  # Light from above
    "transparent": "rgba(0, 0, 0, 0)",                   # Fully transparent
    "panel_backdrop": "rgba(15, 24, 48, 0.85)",          # Frosted panel backdrop
    "badge_bg": "rgba(22, 33, 61, 0.85)",                # Floating badge background
}

TEXT = {
    "text_1": "#EEF3FC",       # Primary headings and active values (17.0:1 on ink-900)
    "text_2": "#A3B1CC",       # Secondary body text and labels (8.8:1 on ink-900)
    "text_3": "#7585A8",       # Muted captions and inactive elements (5.1:1 on ink-900 >= 4.5:1)
}

SEMANTIC = {
    # The Function (the world): gradient along x from aqua -> azure -> periwinkle
    "curve_aqua": "#2EE6D6",
    "curve_azure": "#4DA3FF",
    "curve_periwinkle": "#8F7BFF",
    "curve_glow": "rgba(77, 163, 255, 0.16)",
    "curve_glow_outer": "rgba(46, 230, 214, 0.06)",

    # The Tangent (the tool): amber-gold
    "tangent": "#FFC247",
    "tangent_history": "rgba(255, 194, 71, 0.22)",
    "tangent_halo": "rgba(255, 194, 71, 0.14)",

    # Current Guess x_n (where we are): coral-rose
    "current_x": "#FF5C7A",
    "current_x_history": "rgba(255, 92, 122, 0.35)",
    "current_x_core": "#FFA4B4",
    "current_x_halo": "rgba(255, 92, 122, 0.22)",

    # Next Approximation x_(n+1) (where we are going): lime
    "next_x": "#B6F36B",
    "next_x_history": "rgba(182, 243, 107, 0.35)",
    "next_x_core": "#E2FDC2",
    "next_x_halo": "rgba(182, 243, 107, 0.22)",

    # Final Root: white star core with lime ring and halo
    "root_core": "#FFFFFF",
    "root_ring": "#B6F36B",
    "root_halo": "rgba(182, 243, 107, 0.28)",

    # Reference axes
    "axis_x": "#C7D3EA",

    # Table & interactive highlight
    "table_highlight": "rgba(77, 163, 255, 0.22)",
    "table_highlight_border": "rgba(77, 163, 255, 0.45)",
    "focus_ring": "rgba(77, 163, 255, 0.40)",

    # Ambient stage atmosphere
    "ambient_glow": "rgba(46, 163, 255, 0.05)",
    "vignette": "rgba(5, 8, 15, 0.35)",
}

UI_STATES = {
    "primary": "#4DA3FF",
    "success": "#6EE7A8",
    "warning": "#FFC247",
    "error": "#FF6B7F",
}

FONTS = {
    "display": "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    "body": "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    "mono": "'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace",
}


# ============================================================================
# WCAG Contrast Calculation Helpers
# ============================================================================

def relative_luminance(hex_color: str) -> float:
    """Calculate relative luminance per WCAG 2.1 specs."""
    hex_clean = hex_color.lstrip("#")
    if len(hex_clean) == 3:
        hex_clean = "".join([c * 2 for c in hex_clean])
    r, g, b = [int(hex_clean[i:i+2], 16) / 255.0 for i in (0, 2, 4)]

    def adjust(channel: float) -> float:
        if channel <= 0.03928:
            return channel / 12.92
        return ((channel + 0.055) / 1.055) ** 2.4

    return 0.2126 * adjust(r) + 0.7152 * adjust(g) + 0.0722 * adjust(b)


def contrast_ratio(color_a: str, color_b: str) -> float:
    """Calculate contrast ratio between two hex colors."""
    lum_a = relative_luminance(color_a)
    lum_b = relative_luminance(color_b)
    lighter = max(lum_a, lum_b)
    darker = min(lum_a, lum_b)
    return (lighter + 0.05) / (darker + 0.05)


def check_wcag_aa(text_hex: str, bg_hex: str = SURFACES["ink_900"]) -> bool:
    """Verify if text passes WCAG AA contrast threshold (>= 4.5:1)."""
    return contrast_ratio(text_hex, bg_hex) >= 4.5


# ============================================================================
# CSS Injection String
# ============================================================================

CSS_VARIABLES = f"""
:root {{
    --ink-950: {SURFACES["ink_950"]};
    --ink-900: {SURFACES["ink_900"]};
    --ink-850: {SURFACES["ink_850"]};
    --ink-800: {SURFACES["ink_800"]};
    --line: {SURFACES["line"]};
    --grid-minor: {SURFACES["grid_minor"]};
    --grid-major: {SURFACES["grid_major"]};
    --panel-top-highlight: {SURFACES["panel_top_highlight"]};

    --text-1: {TEXT["text_1"]};
    --text-2: {TEXT["text_2"]};
    --text-3: {TEXT["text_3"]};

    --curve-aqua: {SEMANTIC["curve_aqua"]};
    --curve-azure: {SEMANTIC["curve_azure"]};
    --curve-periwinkle: {SEMANTIC["curve_periwinkle"]};

    --tangent: {SEMANTIC["tangent"]};
    --tangent-history: {SEMANTIC["tangent_history"]};
    --current-x: {SEMANTIC["current_x"]};
    --next-x: {SEMANTIC["next_x"]};
    --root-ring: {SEMANTIC["root_ring"]};
    --table-highlight: {SEMANTIC["table_highlight"]};
    --table-highlight-border: {SEMANTIC["table_highlight_border"]};
    --focus-ring: {SEMANTIC["focus_ring"]};

    --ui-primary: {UI_STATES["primary"]};
    --ui-success: {UI_STATES["success"]};
    --ui-warning: {UI_STATES["warning"]};
    --ui-error: {UI_STATES["error"]};

    --font-display: {FONTS["display"]};
    --font-body: {FONTS["body"]};
    --font-mono: {FONTS["mono"]};
}}
"""
