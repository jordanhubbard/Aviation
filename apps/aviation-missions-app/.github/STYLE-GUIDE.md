# Aviation Mission Management - Style Guide

## Color Contrast Standards

This project follows **WCAG 2.1 Level AA** accessibility standards for color contrast.

### Minimum Contrast Ratios

| Content Type | Minimum Ratio | Recommended |
|--------------|---------------|-------------|
| **Normal Text** (< 18pt) | 4.5:1 | 7:1 (AAA) |
| **Large Text** (≥ 18pt or 14pt bold) | 3:1 | 4.5:1 (AAA) |
| **UI Components** (buttons, icons) | 3:1 | 4.5:1 |
| **Graphical Objects** | 3:1 | - |

### Automated Checking

Run the contrast checker before committing:

```bash
# Check all CSS files for contrast issues
node scripts/check-contrast.js frontend/resources/public/css/styles.css

# Or use the Makefile target
make check-contrast
```

## Color Palette

### Primary Colors

```css
/* Blue - Primary Actions */
--primary-blue: #2563eb;          /* 4.55:1 on white ✅ */
--primary-blue-dark: #1e40af;     /* 7.35:1 on white ✅ */
--primary-blue-hover: #1d4ed8;    /* 6.58:1 on white ✅ */

/* Light blue backgrounds require dark text */
--light-blue-bg: #e3f2fd;         /* Use with --text-dark */
```

### Neutral Colors

```css
/* Text Colors */
--text-dark: #1e293b;             /* 13.45:1 on white ✅ */
--text-medium: #475569;           /* 7.35:1 on white ✅ */
--text-light: #64748b;            /* 5.05:1 on white ✅ */

/* Background Colors */
--bg-white: #ffffff;
--bg-light: #f8fafc;
--bg-gray: #f0f0f0;
```

### Semantic Colors

```css
/* Success - Always with white text */
--success-green: #27ae60;         /* 3.45:1 on white ⚠️  Large text only */
--success-dark: #1e8449;          /* 5.22:1 on white ✅ */

/* Warning - Always with dark text or white */
--warning-orange: #f39c12;        /* 2.37:1 on white ❌ Use dark text */
--warning-dark: #d97706;          /* 3.96:1 on white ⚠️  Large text only */

/* Error - Always with white text */
--error-red: #ef4444;             /* 3.35:1 on white ⚠️  Large text only */
--error-dark: #dc2626;            /* 4.24:1 on white ✅ */

/* Info - Always with white text */
--info-blue: #1976d2;             /* 4.63:1 on white ✅ */
```

## Rules

### ✅ DO

1. **Always test contrast** before committing color changes
2. **Use CSS custom properties** for consistent colors
3. **Provide sufficient contrast** for all text (min 4.5:1)
4. **Use semantic color names** (e.g., `--success-green` not `--green-500`)
5. **Test with dark mode** considerations
6. **Add `:focus` styles** with high contrast
7. **Test with colorblindness simulators**

### ❌ DON'T

1. **Never use low-contrast combinations** (< 3:1 ratio)
2. **Avoid dark text on dark backgrounds**
3. **Don't rely on color alone** to convey information
4. **Avoid pure black (#000)** on pure white - use softer contrasts
5. **Don't use `opacity` to reduce text contrast** below standards
6. **Avoid tiny text** (< 12px) with marginal contrast

## Common Patterns

### Buttons

```css
/* ✅ GOOD - High contrast, clear states */
.btn-primary {
  background-color: #2563eb;  /* 4.55:1 */
  color: white;               /* 21:1 */
  border: 2px solid transparent;
}

.btn-primary:hover {
  background-color: #1d4ed8;  /* 6.58:1 - even better */
}

.btn-primary:focus {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}
```

### Text on Backgrounds

```css
/* ✅ GOOD - Dark text on light background */
.card {
  background: #ffffff;
  color: #1e293b;  /* 13.45:1 ✅ */
}

/* ✅ GOOD - Light text on dark background */
.dark-card {
  background: #1e293b;
  color: #ffffff;  /* 13.45:1 ✅ */
}

/* ❌ BAD - Low contrast */
.bad-card {
  background: #64748b;
  color: #475569;  /* ~1.5:1 ❌ FAIL */
}
```

### Status Indicators

```css
/* ✅ GOOD - High contrast badges */
.badge-success {
  background-color: #1e8449;  /* Darker green */
  color: white;                /* 5.22:1 ✅ */
  font-weight: 600;
  font-size: 0.875rem;
}

/* ⚠️  WARNING - Only for large text */
.badge-info-large {
  background-color: #27ae60;
  color: white;                /* 3.45:1 ⚠️  */
  font-size: 18px;             /* Must be large */
  font-weight: bold;
}
```

## Testing

### Manual Testing

1. **Chrome DevTools**: Inspect element → Accessibility pane → Contrast ratio
2. **WebAIM Contrast Checker**: https://webaim.org/resources/contrastchecker/
3. **Colour Contrast Analyser**: Desktop app for Mac/Windows

### Automated Testing

```bash
# Run contrast checker
make check-contrast

# Run accessibility linter
make lint-a11y

# Run full test suite
make test
```

### Browser Extensions

- **aXe DevTools** - Comprehensive accessibility testing
- **WAVE** - Visual feedback about accessibility
- **Colorblindly** - Simulates color vision deficiencies

## CI/CD Integration

The contrast checker runs automatically in CI/CD:

```yaml
# .github/workflows/ci.yml
- name: Check Color Contrast
  run: node scripts/check-contrast.js frontend/resources/public/css/styles.css
```

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Color Safe](http://colorsafe.co/) - Beautiful, accessible color palettes
- [Accessible Colors](https://accessible-colors.com/) - WCAG color palette generator

## Quick Reference

### Contrast Ratios at a Glance

| Foreground | Background | Ratio | Status |
|------------|------------|-------|--------|
| `#1e293b` | `#ffffff` | 13.45:1 | ✅ AAA |
| `#2563eb` | `#ffffff` | 4.55:1 | ✅ AA |
| `#64748b` | `#ffffff` | 5.05:1 | ✅ AA |
| `#f39c12` | `#000000` | 8.84:1 | ✅ AAA |
| `#ffffff` | `#2563eb` | 4.61:1 | ✅ AA |
| `#ffffff` | `#1e293b` | 13.45:1 | ✅ AAA |

---

**Remember**: When in doubt, aim for higher contrast ratios. Your users will thank you!

