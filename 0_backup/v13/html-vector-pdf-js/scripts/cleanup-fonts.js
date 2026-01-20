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

const PLACEHOLDER = 'EMBEDDED_FONT_DATA_PLACEHOLDER';

console.log('🧹 Cleaning up fontLoader.ts...');

try {
    // Read the fontLoader.ts file
    let fontLoaderContent = readFileSync(FONT_LOADER_PATH, 'utf-8');

    // Check if it needs cleaning
    if (fontLoaderContent.includes(`"${PLACEHOLDER}"`)) {
        console.log('✅ fontLoader.ts is already clean (contains placeholder)');
        process.exit(0);
    }

    // Find and replace the base64 data with placeholder
    const regex = /const EMBEDDED_FONT_DATA = "([^"]+)";/;
    const match = fontLoaderContent.match(regex);

    if (!match) {
        console.error('❌ Error: Could not find EMBEDDED_FONT_DATA declaration');
        process.exit(1);
    }

    const currentData = match[1];

    if (currentData.length < 100) {
        console.log('⚠️  Warning: Font data seems too small, might already be placeholder');
        console.log(`   Current value: "${currentData}"`);
        process.exit(0);
    }

    // Replace with placeholder
    fontLoaderContent = fontLoaderContent.replace(
        regex,
        `const EMBEDDED_FONT_DATA = "${PLACEHOLDER}";`
    );

    // Write back to file
    writeFileSync(FONT_LOADER_PATH, fontLoaderContent, 'utf-8');

    console.log('✅ fontLoader.ts cleaned successfully!');
    console.log(`📦 Removed ${(currentData.length / 1024 / 1024).toFixed(2)} MB of font data`);
    console.log(`📦 New file size: ${(fontLoaderContent.length / 1024).toFixed(2)} KB`);

} catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    process.exit(1);
}
