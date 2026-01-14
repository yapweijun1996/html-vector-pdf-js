#!/usr/bin/env node

/**
 * Font Injection Build Script
 * 
 * This script injects base64-encoded font data into fontLoader.ts during build time.
 * The source code should NOT contain the actual base64 data - only a placeholder.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '..');
const FONT_LOADER_PATH = join(PROJECT_ROOT, 'services', 'fontLoader.ts');
const FONT_BASE64_PATH = join(PROJECT_ROOT, 'fonts', 'NotoSansSC-Regular.base64.txt');

const PLACEHOLDER = 'EMBEDDED_FONT_DATA_PLACEHOLDER';

console.log('🔧 Injecting font data into fontLoader.ts...');

try {
    // Read the base64 font data
    console.log('📖 Reading base64 font data...');
    const base64Data = readFileSync(FONT_BASE64_PATH, 'utf-8').trim();
    console.log(`✅ Font data loaded: ${(base64Data.length / 1024 / 1024).toFixed(2)} MB`);

    // Read the fontLoader.ts file
    console.log('📖 Reading fontLoader.ts...');
    let fontLoaderContent = readFileSync(FONT_LOADER_PATH, 'utf-8');

    // Check if placeholder exists
    if (!fontLoaderContent.includes(PLACEHOLDER)) {
        console.error('❌ Error: Placeholder not found in fontLoader.ts');
        console.error(`   Expected to find: "${PLACEHOLDER}"`);
        process.exit(1);
    }

    // Replace placeholder with actual base64 data
    console.log('🔄 Injecting font data...');
    fontLoaderContent = fontLoaderContent.replace(
        `"${PLACEHOLDER}"`,
        `"${base64Data}"`
    );

    // Write back to file
    console.log('💾 Writing updated fontLoader.ts...');
    writeFileSync(FONT_LOADER_PATH, fontLoaderContent, 'utf-8');

    console.log('✅ Font injection completed successfully!');
    console.log(`📦 fontLoader.ts size: ${(fontLoaderContent.length / 1024 / 1024).toFixed(2)} MB`);

} catch (error) {
    console.error('❌ Font injection failed:', error.message);
    process.exit(1);
}
