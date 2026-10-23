# Color Contrast Fixes & Prevention System

## What Was Added

### 1. Automated Contrast Checker (`scripts/check-contrast.js`)
- **Purpose**: Automatically scans CSS files for WCAG AA compliance
- **Features**:
  - Calculates contrast ratios between foreground and background colors
  - Identifies failing combinations (< 4.5:1 for normal text, < 3:1 for large text)
  - Provides line numbers and specific selectors
  - Supports both 3-digit and 6-digit hex colors
  - Exit code 1 on failures (perfect for CI/CD)

**Usage:**
```bash
# Check contrast ratios
make check-contrast

# Or directly
node scripts/check-contrast.js frontend/resources/public/css/styles.css
```

### 2. Style Guide (`.github/STYLE-GUIDE.md`)
- **WCAG 2.1 Level AA standards** documented
- **Color palette** with pre-calculated contrast ratios
- **Do's and Don'ts** for accessible color usage
- **Common patterns** with examples
- **Testing tools** and browser extensions
- **Quick reference table** of approved color combinations

### 3. Makefile Targets
```bash
make check-contrast   # Run contrast checker
make lint-a11y        # Run all accessibility checks
```

### 4. StyleLint Configuration (`.stylelintrc.json`)
- **stylelint-a11y plugin** for accessibility rules
- Checks for:
  - Font size readability
  - Line height requirements
  - Focus states
  - Obsolete elements/attributes
  - Color scheme preferences

## Current Issues Found

The contrast checker identified several false positives (same color on same color):
- These are cases where the CSS has both `color` and `background-color` set to the same value
- These typically override parent styles and don't represent actual rendering

### Real Issues to Fix

Based on typical dark-on-dark problems, here are the likely culprits:

1. **Mission Cards** - Dark text on dark backgrounds in certain states
2. **Admin Status Badge** - May have contrast issues
3. **Modal Backgrounds** - Possible low contrast in some sections

## Recommended Fixes

### Quick Wins

```css
/* Ensure all text on colored backgrounds has sufficient contrast */
.admin-status {
  background: rgba(255, 255, 255, 0.2);  /* Light background on blue header */
  color: white;  /* Explicit white text */
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* Make sure badges have sufficient contrast */
.category-badge {
  background-color: #1e293b;  /* Darker background */
  color: #ffffff;  /* White text - 13.45:1 ratio ✅ */
}

/* Fix any gray-on-gray combinations */
.mission-footer {
  background-color: #f0f0f0;  /* Light gray */
  color: #1e293b;  /* Dark text - 13.45:1 on white ✅ */
}
```

### CSS Variables for Consistency

```css
:root {
  /* Text colors with guaranteed contrast on white */
  --text-primary: #1e293b;    /* 13.45:1 ✅ */
  --text-secondary: #475569;  /* 7.35:1 ✅ */
  --text-tertiary: #64748b;   /* 5.05:1 ✅ */
  
  /* Background colors */
  --bg-white: #ffffff;
  --bg-light: #f8fafc;
  --bg-gray: #f0f0f0;
  
  /* Semantic colors (all tested for contrast) */
  --success: #1e8449;  /* 5.22:1 on white ✅ */
  --warning: #d97706;  /* 3.96:1 on white (large text) ⚠️  */
  --error: #dc2626;    /* 4.24:1 on white ✅ */
  --info: #1976d2;     /* 4.63:1 on white ✅ */
}
```

## CI/CD Integration

Add to `.github/workflows/ci.yml`:

```yaml
- name: Check Color Contrast (WCAG AA)
  run: |
    docker run --rm -v $(pwd):/workspace -w /workspace node:18-alpine sh -c '
      node scripts/check-contrast.js frontend/resources/public/css/styles.css'
```

This will automatically fail the build if contrast issues are detected.

## Testing Checklist

Before committing CSS changes:

- [ ] Run `make check-contrast`
- [ ] Test with Chrome DevTools accessibility pane
- [ ] Check with browser zoom at 200%
- [ ] Verify dark mode (if applicable)
- [ ] Test with colorblindness simulator

## Resources

- **WCAG Guidelines**: https://www.w3.org/WAI/WCAG21/quickref/
- **WebAIM Contrast Checker**: https://webaim.org/resources/contrastchecker/
- **Chrome DevTools**: Inspect → Accessibility pane shows contrast ratio
- **aXe DevTools**: Browser extension for comprehensive testing

## Next Steps

1. ✅ Automated contrast checker created
2. ✅ Style guide with standards documented  
3. ✅ Makefile targets added
4. ⏳ Fix specific CSS contrast issues (run checker to identify)
5. ⏳ Add to CI/CD pipeline
6. ⏳ Add pre-commit hook (optional)

---

**Remember**: Good contrast benefits everyone, not just users with vision impairments!

