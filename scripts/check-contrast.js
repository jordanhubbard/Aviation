#!/usr/bin/env node
/**
 * WCAG Contrast Checker for CSS files
 * Automatically checks color contrast ratios for WCAG AA compliance
 * 
 * WCAG AA Requirements:
 * - Normal text: 4.5:1 minimum
 * - Large text (18pt+): 3:1 minimum
 * - UI components: 3:1 minimum
 */

const fs = require('fs');
const path = require('path');

// Parse hex color to RGB
function hexToRgb(hex) {
  // Normalize hex (remove #, expand 3-digit to 6-digit)
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Calculate relative luminance
function getLuminance(rgb) {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
    val = val / 255;
    return val <= 0.03928
      ? val / 12.92
      : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Calculate contrast ratio
function getContrastRatio(color1, color2) {
  const lum1 = getLuminance(hexToRgb(color1));
  const lum2 = getLuminance(hexToRgb(color2));
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// Check if contrast ratio meets WCAG AA standards
function meetsWCAG_AA(ratio, isLargeText = false) {
  const minimum = isLargeText ? 3.0 : 4.5;
  return ratio >= minimum;
}

// Extract color pairs from CSS
function extractColorPairs(cssContent) {
  const pairs = [];
  const rules = cssContent.split('}');
  
  for (const rule of rules) {
    const selector = rule.split('{')[0]?.trim();
    const declarations = rule.split('{')[1];
    
    if (!declarations) continue;
    
    const colorMatch = declarations.match(/color:\s*(#[0-9a-fA-F]{3,6})/);
    const bgMatch = declarations.match(/background(?:-color)?:\s*(#[0-9a-fA-F]{3,6})/);
    
    if (colorMatch && bgMatch) {
      pairs.push({
        selector,
        foreground: colorMatch[1],
        background: bgMatch[1],
        line: cssContent.substring(0, rule.indexOf(declarations)).split('\n').length
      });
    }
  }
  
  return pairs;
}

// Main contrast checking function
function checkContrast(cssFilePath) {
  console.log('🎨 WCAG Contrast Checker\n');
  console.log(`Checking: ${cssFilePath}\n`);
  
  if (!fs.existsSync(cssFilePath)) {
    console.error(`❌ File not found: ${cssFilePath}`);
    process.exit(1);
  }
  
  const cssContent = fs.readFileSync(cssFilePath, 'utf8');
  const pairs = extractColorPairs(cssContent);
  
  let failures = 0;
  let warnings = 0;
  let passes = 0;
  
  console.log('Contrast Ratios (WCAG AA requires 4.5:1 for normal text, 3:1 for large):\n');
  
  for (const pair of pairs) {
    try {
      const ratio = getContrastRatio(pair.foreground, pair.background);
      const meetsStandard = meetsWCAG_AA(ratio, false);
      const meetsLargeText = meetsWCAG_AA(ratio, true);
      
      const status = meetsStandard ? '✅' : (meetsLargeText ? '⚠️ ' : '❌');
      const grade = meetsStandard ? 'PASS' : (meetsLargeText ? 'LARGE TEXT ONLY' : 'FAIL');
      
      if (meetsStandard) {
        passes++;
      } else if (meetsLargeText) {
        warnings++;
      } else {
        failures++;
      }
      
      console.log(`${status} ${ratio.toFixed(2)}:1 - ${grade}`);
      console.log(`   ${pair.selector}`);
      console.log(`   Foreground: ${pair.foreground} on Background: ${pair.background}`);
      console.log(`   Line: ~${pair.line}\n`);
    } catch (error) {
      console.error(`⚠️  Error checking pair: ${pair.selector}`);
      console.error(`   ${error.message}\n`);
    }
  }
  
  console.log('═══════════════════════════════════════════');
  console.log(`Total Checks: ${pairs.length}`);
  console.log(`✅ Passes: ${passes}`);
  console.log(`⚠️  Warnings (large text only): ${warnings}`);
  console.log(`❌ Failures: ${failures}`);
  console.log('═══════════════════════════════════════════\n');
  
  if (failures > 0) {
    console.error('❌ Contrast check failed! Fix the failures above.');
    process.exit(1);
  } else if (warnings > 0) {
    console.warn('⚠️  Some color combinations only meet large text standards.');
    console.warn('   Consider improving contrast for better accessibility.');
  } else {
    console.log('✅ All contrast checks passed!');
  }
}

// Run the checker
const cssFile = process.argv[2] || path.join(__dirname, '../frontend/resources/public/css/styles.css');
checkContrast(cssFile);

