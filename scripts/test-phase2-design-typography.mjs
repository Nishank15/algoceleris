import fs from 'fs';
import path from 'path';
import assert from 'assert';

const rootDir = process.cwd();
const indexCssPath = path.join(rootDir, 'packages/frontend/src/index.css');
const cssContent = fs.readFileSync(indexCssPath, 'utf8');

console.log('--- Running Phase 2 Design & Typography Audit Test Suite ---');

// 1. Concentric Border-Radii
assert(
  cssContent.includes('.linear-card') || cssContent.includes('.auth-card'),
  'FAIL: index.css must declare .linear-card or .auth-card with concentric radius'
);
assert(
  cssContent.includes('.linear-input'),
  'FAIL: index.css must declare .linear-input with concentric radius'
);
assert(
  cssContent.includes('.problem-table-container') || (cssContent.includes('.catalog-table-wrapper') && cssContent.includes('--radius-lg')),
  'FAIL: Catalog / problem table container must declare border-radius: var(--radius-lg)'
);

// 2. Tabular Numbers
assert(
  /\.latency-pill[\s\S]*?tabular-nums/.test(cssContent),
  'FAIL: .latency-pill must declare font-variant-numeric: tabular-nums'
);
assert(
  /\.tabular-nums[\s\S]*?font-variant-numeric:\s*tabular-nums/.test(cssContent),
  'FAIL: index.css must provide .tabular-nums utility class'
);
assert(
  /\.acceptance-rate-mono[\s\S]*?tabular-nums/.test(cssContent),
  'FAIL: .acceptance-rate-mono must declare font-variant-numeric: tabular-nums'
);
assert(
  /\.diff-line-num[\s\S]*?tabular-nums/.test(cssContent),
  'FAIL: .diff-line-num must declare font-variant-numeric: tabular-nums'
);

// 3. Optical Alignment & Typography
assert(
  /\.linear-brand[\s\S]*?gap:\s*6px/.test(cssContent) && /\.linear-brand[\s\S]*?line-height:\s*1/.test(cssContent),
  'FAIL: .linear-brand must declare gap: 6px and line-height: 1'
);
assert(
  /\.latency-pill[\s\S]*?line-height:\s*1/.test(cssContent),
  'FAIL: .latency-pill must declare line-height: 1'
);
assert(
  /\.version-pill[\s\S]*?letter-spacing:\s*0\.0[4-6]em/.test(cssContent),
  'FAIL: .version-pill uppercase text must declare letter-spacing >= 0.04em'
);
assert(
  /\.diff-column-header[\s\S]*?letter-spacing:\s*0\.0[4-6]em/.test(cssContent),
  'FAIL: .diff-column-header uppercase text must declare letter-spacing >= 0.04em'
);

// 4. Light Mode Contrast Ratio
// Verify --text-muted in [data-theme='light'] is not #8b929e (which fails 4.5:1 AA against white)
const lightThemeMatch = cssContent.match(/:root\[data-theme=['"]light['"]\][\s\S]*?--text-muted:\s*(#[0-9a-fA-F]{6})/);
assert(lightThemeMatch, 'FAIL: :root[data-theme="light"] must define --text-muted');
const lightMutedHex = lightThemeMatch[1].toLowerCase();
assert(
  lightMutedHex !== '#8b929e',
  `FAIL: Light mode --text-muted is ${lightMutedHex} (contrast ~3.1:1 fails WCAG 2.1 AA 4.5:1 against #ffffff)`
);

console.log('--- ALL PHASE 2 DESIGN & TYPOGRAPHY TESTS PASSED ---');
