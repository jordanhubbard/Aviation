#!/bin/bash
# Check color contrast across all applications in the monorepo

set -e

echo "🎨 Checking color contrast across all applications..."
echo ""

FAIL_COUNT=0
SUCCESS_COUNT=0

# Find all CSS files in apps
CSS_FILES=$(find apps -name "*.css" -type f | grep -v node_modules | grep -v .venv)

if [ -z "$CSS_FILES" ]; then
    echo "⚠️  No CSS files found"
    exit 0
fi

for css_file in $CSS_FILES; do
    echo "Checking: $css_file"
    if node scripts/check-contrast.js "$css_file"; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary:"
echo "   ✅ Passed: $SUCCESS_COUNT files"
echo "   ❌ Failed: $FAIL_COUNT files"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $FAIL_COUNT -gt 0 ]; then
    echo ""
    echo "⚠️  $FAIL_COUNT file(s) have contrast issues."
    echo "See docs/COLOR_SCHEME.md for guidance on fixing contrast issues."
    exit 1
fi

echo ""
echo "✅ All CSS files pass WCAG AA contrast requirements!"
