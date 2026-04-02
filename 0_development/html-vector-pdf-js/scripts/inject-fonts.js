#!/usr/bin/env node

/**
 * Font Injection Build Script
 * 
 * This script injects base64-encoded font data into fontLoader.ts during build time.
 * The source code should NOT contain the actual base64 data - only a placeholder.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '..');
const FONT_LOADER_PATH = join(PROJECT_ROOT, 'services', 'fontLoader.ts');

const INJECT_TARGETS = [
  {
    constName: 'EMBEDDED_FONT_DATA_NOTOSANSSC_NORMAL',
    placeholder: 'EMBEDDED_FONT_DATA_NOTOSANSSC_NORMAL_PLACEHOLDER',
    base64Path: join(PROJECT_ROOT, 'fonts', 'NotoSansSC-Regular.base64.txt')
  },
  {
    constName: 'EMBEDDED_FONT_DATA_NOTOSANSSC_BOLD',
    placeholder: 'EMBEDDED_FONT_DATA_NOTOSANSSC_BOLD_PLACEHOLDER',
    base64Path: join(PROJECT_ROOT, 'fonts', 'NotoSansSC-Bold.base64.txt')
  },
  {
    constName: 'EMBEDDED_FONT_DATA_NOTOSANS_NORMAL',
    placeholder: 'EMBEDDED_FONT_DATA_NOTOSANS_NORMAL_PLACEHOLDER',
    base64Path: join(PROJECT_ROOT, 'fonts', 'NotoSans-Regular.base64.txt')
  },
  {
    constName: 'EMBEDDED_FONT_DATA_NOTOSANS_BOLD',
    placeholder: 'EMBEDDED_FONT_DATA_NOTOSANS_BOLD_PLACEHOLDER',
    base64Path: join(PROJECT_ROOT, 'fonts', 'NotoSans-Bold.base64.txt')
  },
  {
    constName: 'EMBEDDED_FONT_DATA_CARLITO_NORMAL',
    placeholder: 'EMBEDDED_FONT_DATA_CARLITO_NORMAL_PLACEHOLDER',
    base64Path: join(PROJECT_ROOT, 'fonts', 'Carlito-Regular.base64.txt')
  },
  {
    constName: 'EMBEDDED_FONT_DATA_CARLITO_BOLD',
    placeholder: 'EMBEDDED_FONT_DATA_CARLITO_BOLD_PLACEHOLDER',
    base64Path: join(PROJECT_ROOT, 'fonts', 'Carlito-Bold.base64.txt')
  },
  {
    constName: 'EMBEDDED_FONT_DATA_LIBERATIONSANS_NORMAL',
    placeholder: 'EMBEDDED_FONT_DATA_LIBERATIONSANS_NORMAL_PLACEHOLDER',
    base64Path: join(PROJECT_ROOT, 'fonts', 'LiberationSans-Regular.base64.txt')
  },
  {
    constName: 'EMBEDDED_FONT_DATA_LIBERATIONSANS_BOLD',
    placeholder: 'EMBEDDED_FONT_DATA_LIBERATIONSANS_BOLD_PLACEHOLDER',
    base64Path: join(PROJECT_ROOT, 'fonts', 'LiberationSans-Bold.base64.txt')
  }
];

console.log('🔧 Injecting font data into fontLoader.ts...');

try {
  // Read the fontLoader.ts file
  console.log('📖 Reading fontLoader.ts...');
  let fontLoaderContent = readFileSync(FONT_LOADER_PATH, 'utf-8');

  let injectedCount = 0;

  for (const t of INJECT_TARGETS) {
    if (!fontLoaderContent.includes(`"${t.placeholder}"`)) {
      console.warn(`⚠️  Placeholder not found for ${t.constName}: "${t.placeholder}" (skipping)`);
      continue;
    }

    if (!existsSync(t.base64Path)) {
      console.warn(`⚠️  Missing font base64 file: ${t.base64Path} (skipping)`);
      continue;
    }

    console.log(`📖 Reading base64 font data: ${t.base64Path}`);
    const base64Data = readFileSync(t.base64Path, 'utf-8').trim();
    console.log(`✅ Loaded ${(base64Data.length / 1024 / 1024).toFixed(2)} MB for ${t.constName}`);

    console.log(`🔄 Injecting ${t.constName}...`);
    fontLoaderContent = fontLoaderContent.replace(`"${t.placeholder}"`, `"${base64Data}"`);
    injectedCount++;
  }

  if (injectedCount === 0) {
    console.warn('⚠️  No font data injected (no matching placeholders or missing base64 files).');
  }

  // Write back to file
  console.log('💾 Writing updated fontLoader.ts...');
  writeFileSync(FONT_LOADER_PATH, fontLoaderContent, 'utf-8');

  console.log('✅ Font injection completed successfully!');
  console.log(`📦 fontLoader.ts size: ${(fontLoaderContent.length / 1024 / 1024).toFixed(2)} MB`);

} catch (error) {
  console.error('❌ Font injection failed:', error.message);
  process.exit(1);
}
