#!/usr/bin/env node

/**
 * Font Cleanup Script
 * 
 * This script restores fontLoader.ts to its original state with placeholder.
 * Use this to clean up after build or before committing to Git.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '..');
const FONT_LOADER_PATH = join(PROJECT_ROOT, 'services', 'fontLoader.ts');

const PLACEHOLDERS = [
  { constName: 'EMBEDDED_FONT_DATA_NOTOSANSSC_NORMAL', placeholder: 'EMBEDDED_FONT_DATA_NOTOSANSSC_NORMAL_PLACEHOLDER' },
  { constName: 'EMBEDDED_FONT_DATA_NOTOSANSSC_BOLD', placeholder: 'EMBEDDED_FONT_DATA_NOTOSANSSC_BOLD_PLACEHOLDER' },
  { constName: 'EMBEDDED_FONT_DATA_NOTOSANS_NORMAL', placeholder: 'EMBEDDED_FONT_DATA_NOTOSANS_NORMAL_PLACEHOLDER' },
  { constName: 'EMBEDDED_FONT_DATA_NOTOSANS_BOLD', placeholder: 'EMBEDDED_FONT_DATA_NOTOSANS_BOLD_PLACEHOLDER' }
];

console.log('🧹 Cleaning up fontLoader.ts...');

try {
    // Read the fontLoader.ts file
    let fontLoaderContent = readFileSync(FONT_LOADER_PATH, 'utf-8');

    const alreadyClean = PLACEHOLDERS.every(({ placeholder }) => fontLoaderContent.includes(`"${placeholder}"`));
    if (alreadyClean) {
        console.log('✅ fontLoader.ts is already clean (contains placeholders)');
        process.exit(0);
    }

    let removedChars = 0;
    for (const { constName, placeholder } of PLACEHOLDERS) {
        const regex = new RegExp(`const\\s+${constName}\\s*=\\s*\\"([^\\"]+)\\";`);
        const match = fontLoaderContent.match(regex);
        if (!match) continue;
        const current = match[1];
        if (current.includes('_PLACEHOLDER')) continue;
        if (current.length < 100) continue;
        removedChars += current.length;
        fontLoaderContent = fontLoaderContent.replace(regex, `const ${constName} = "${placeholder}";`);
    }

    // Write back to file
    writeFileSync(FONT_LOADER_PATH, fontLoaderContent, 'utf-8');

    console.log('✅ fontLoader.ts cleaned successfully!');
    console.log(`📦 Removed ~${(removedChars / 1024 / 1024).toFixed(2)} MB of font data`);
    console.log(`📦 New file size: ${(fontLoaderContent.length / 1024).toFixed(2)} KB`);

} catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    process.exit(1);
}
