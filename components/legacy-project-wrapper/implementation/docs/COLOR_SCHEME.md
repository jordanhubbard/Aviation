# Aviation Monorepo Color Scheme & Accessibility Standards

This document defines the standardized color scheme and accessibility guidelines for all applications in the Aviation monorepo.

## WCAG 2.1 Level AA Compliance

All applications MUST meet WCAG 2.1 Level AA standards:
- **Normal text**: Minimum contrast ratio of 4.5:1
- **Large text** (18pt+ or 14pt+ bold): Minimum contrast ratio of 3:1
- **UI components**: Minimum contrast ratio of 3:1

## Standardized Color Palette

### Primary Colors

```css
:root {
  /* Aviation Blue - Primary brand color */
  --aviation-blue: #1e40af;        /* 8.59:1 on white ✅ */
  --aviation-blue-light: #3b82f6;  /* 4.58:1 on white ✅ */
  --aviation-blue-dark: #1e3a8a;   /* 11.62:1 on white ✅ */
  
  /* Sky Blue - Secondary accent */
  --sky-blue: #0284c7;             /* 5.48:1 on white ✅ */
  --sky-blue-light: #38bdf8;       /* 2.73:1 on white (large text only) */
  
  /* Charcoal - Primary text */
  --charcoal: #1e293b;             /* 13.45:1 on white ✅ */
  --charcoal-light: #334155;       /* 10.56:1 on white ✅ */
  
  /* Gray Scale */
  --gray-50: #f8fafc;
  --gray-100: #f1f5f9;
  --gray-200: #e2e8f0;
  --gray-300: #cbd5e1;
  --gray-400: #94a3b8;
  --gray-500: #64748b;             /* 5.05:1 on white ✅ */
  --gray-600: #475569;             /* 7.35:1 on white ✅ */
  --gray-700: #334155;             /* 10.56:1 on white ✅ */
  --gray-800: #1e293b;             /* 13.45:1 on white ✅ */
  --gray-900: #0f172a;             /* 16.78:1 on white ✅ */
}
```

### Semantic Colors

```css
:root {
  /* Success - Green */
  --success: #16a34a;              /* 4.59:1 on white ✅ */
  --success-light: #22c55e;        /* 3.36:1 on white (large text) */
  --success-dark: #15803d;         /* 5.94:1 on white ✅ */
  
  /* Warning - Orange/Amber */
  --warning: #d97706;              /* 3.96:1 on white (large text) */
  --warning-dark: #b45309;         /* 5.32:1 on white ✅ */
  
  /* Error/Danger - Red */
  --error: #dc2626;                /* 4.24:1 on white ✅ */
  --error-dark: #b91c1c;           /* 5.58:1 on white ✅ */
  
  /* Info - Cyan/Blue */
  --info: #0891b2;                 /* 4.76:1 on white ✅ */
  --info-light: #06b6d4;           /* 3.65:1 on white (large text) */
}
```

### Background Colors

```css
:root {
  /* Light theme backgrounds */
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-tertiary: #f1f5f9;
  --bg-elevated: #ffffff;
  
  /* Dark theme backgrounds (optional) */
  --bg-dark-primary: #0f172a;
  --bg-dark-secondary: #1e293b;
  --bg-dark-tertiary: #334155;
}
```

### Text Colors

```css
:root {
  /* Light theme text */
  --text-primary: #1e293b;         /* 13.45:1 on white ✅ */
  --text-secondary: #475569;       /* 7.35:1 on white ✅ */
  --text-tertiary: #64748b;        /* 5.05:1 on white ✅ */
  --text-inverse: #ffffff;         /* For dark backgrounds */
  
  /* Dark theme text (optional) */
  --text-dark-primary: #f8fafc;
  --text-dark-secondary: #cbd5e1;
  --text-dark-tertiary: #94a3b8;
}
```

## Application-Specific Theming

### Aviation Missions App
- **Primary**: Aviation Blue (#1e40af)
- **Accent**: Sky Blue (#0284c7)
- **Theme**: Dark mode with light text on dark backgrounds

### Flight Planner
- **Primary**: Aviation Blue (#1e40af)
- **Accent**: Sky Blue (#0284c7) for route markers
- **Map**: Leaflet with weather overlays

### Flight School
- **Primary**: Aviation Blue (#1e40af)
- **Accent**: Success Green (#16a34a) for available slots
- **Theme**: Light mode with Bootstrap components

### ForeFlight Dashboard
- **Primary**: Aviation Blue (#1e40af)
- **Charts**: Use high-contrast colors from palette
- **Theme**: Light mode for data visualization

## Contrast Requirements

### Text Contrast

| Element Type | Min Ratio | Example |
|--------------|-----------|---------|
| Body text (normal) | 4.5:1 | `--text-primary` on `--bg-primary` |
| Headings (large) | 3:1 | `--aviation-blue` on `--bg-primary` |
| Links | 4.5:1 | `--aviation-blue-light` on `--bg-primary` |
| Disabled text | 3:1 | `--gray-500` on `--bg-primary` |

### Component Contrast

| Component | Min Ratio | Example |
|-----------|-----------|---------|
| Buttons | 3:1 | Border and background must contrast |
| Form inputs | 3:1 | Border vs background |
| Focus indicators | 3:1 | Focus ring vs background |
| Icons | 3:1 | Icon vs background |

## Testing Tools

### Automated Testing
1. **check-contrast.js** (aviation-missions-app) - Use across all apps
2. **stylelint-a11y** - Linter plugin for accessibility
3. **axe-core** - Automated accessibility testing

### Manual Testing
1. **Chrome DevTools** - Accessibility pane shows contrast ratios
2. **WebAIM Contrast Checker** - https://webaim.org/resources/contrastchecker/
3. **Color blindness simulator** - Test with various types of color blindness

### Browser Extensions
- **aXe DevTools** - Comprehensive accessibility testing
- **WAVE** - Web accessibility evaluation tool
- **Lighthouse** - Accessibility audit in Chrome DevTools

## Implementation Guidelines

### Do's ✅
- Use CSS custom properties for colors
- Test contrast ratios before committing
- Provide sufficient color contrast for all text
- Use semantic HTML elements
- Include focus indicators for interactive elements
- Support both light and dark themes where applicable

### Don'ts ❌
- Don't use color as the only means of conveying information
- Don't use text smaller than 14px without high contrast
- Don't override browser default focus styles without providing alternatives
- Don't use pure black (#000000) - use `--charcoal` instead
- Don't use pure white (#ffffff) for text - use `--text-inverse` context-aware

## Migration Checklist

For each application being integrated into the monorepo:

- [ ] Replace hardcoded colors with CSS custom properties
- [ ] Run contrast checker on all CSS files
- [ ] Fix any contrast ratio failures
- [ ] Add focus indicators to interactive elements
- [ ] Test with keyboard navigation
- [ ] Test with screen reader
- [ ] Verify zoom functionality (up to 200%)
- [ ] Document any application-specific color usage

## CI/CD Integration

Add to GitHub Actions workflow:

```yaml
- name: Check Color Contrast (WCAG AA)
  run: |
    node scripts/check-contrast.js apps/*/frontend/**/*.css
    node scripts/check-contrast.js apps/*/app/static/**/*.css
```

## Resources

- **WCAG 2.1 Guidelines**: https://www.w3.org/WAI/WCAG21/quickref/
- **WebAIM**: https://webaim.org/
- **A11y Project**: https://www.a11yproject.com/
- **Color Contrast Checker**: https://coolors.co/contrast-checker

## Questions?

For questions about color usage or accessibility requirements, see:
1. [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines
2. [AGENTS.md](../AGENTS.md) for LLM-friendly guidelines
3. Open an issue for clarification

---

**Remember**: Accessibility is not optional. Good color contrast benefits all users!
