#!/usr/bin/env node
/**
 * Font Preparation Script
 *
 * Goal:
 * - Download required font binaries into /fonts (if missing)
 * - Generate single-line base64 txt files used by scripts/inject-fonts.js
 *
 * Notes:
 * - We intentionally generate ONE-LINE base64 (no wrapping/newlines). inject-fonts.js
 *   injects it into a normal quoted string literal.
 * - Keep this script dependency-free (Node >= 20).
 */

import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '..');
const FONTS_DIR = join(PROJECT_ROOT, 'fonts');

/**
 * Font sources:
 * We use a public Google Fonts mirror with stable direct file links.
 *
 * Important:
 * - We intentionally download variable-font TTFs and reuse them for
 *   both "normal" and "bold" variants (to prevent missing-font errors).
 * - If you later want true bold outlines, replace the TTF URLs with static
 *   bold font files and rerun this script.
 */
const FONT_SPECS = [
  {
    fileName: 'NotoSans-Regular.ttf',
    url: 'https://static.oeh.ac.at/fonts/ofl/notosans/NotoSans%5bwdth,wght%5d.ttf'
  },
  {
    fileName: 'NotoSans-Bold.ttf',
    url: 'https://static.oeh.ac.at/fonts/ofl/notosans/NotoSans%5bwdth,wght%5d.ttf'
  },
  {
    fileName: 'NotoSansSC-Bold.ttf',
    url: 'https://static.oeh.ac.at/fonts/ofl/notosanssc/NotoSansSC%5bwght%5d.ttf'
  }
];

const ensureDir = (dirPath) => {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
};

const isNonEmptyFile = (filePath) => {
  if (!existsSync(filePath)) return false;
  try {
    return statSync(filePath).size > 0;
  } catch {
    return false;
  }
};

const downloadFile = (url, outPath) =>
  new Promise((resolve, reject) => {
    const file = createWriteStream(outPath);
    const req = https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(() => {
          downloadFile(res.headers.location, outPath).then(resolve).catch(reject);
        });
        return;
      }

      if (res.statusCode !== 200) {
        file.close(() => reject(new Error(`HTTP ${res.statusCode} for ${url}`)));
        return;
      }

      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    });

    req.on('error', (err) => {
      file.close(() => reject(err));
    });
  });

const toBase64SingleLine = (binPath) => {
  const buf = readFileSync(binPath);
  return buf.toString('base64');
};

const main = async () => {
  ensureDir(FONTS_DIR);

  let downloaded = 0;
  let generated = 0;

  for (const spec of FONT_SPECS) {
    const ttfPath = join(FONTS_DIR, spec.fileName);
    const base64Path = join(FONTS_DIR, spec.fileName.replace(/\.ttf$/i, '.base64.txt'));

    if (!isNonEmptyFile(ttfPath)) {
      console.log(`⬇️  Downloading ${spec.fileName}...`);
      await downloadFile(spec.url, ttfPath);
      downloaded++;
    } else {
      console.log(`✅ Found ${spec.fileName} (skip download)`);
    }

    if (!existsSync(base64Path)) {
      console.log(`🧾 Generating ${dirname(base64Path).split('/').pop()}/${spec.fileName.replace(/\.ttf$/i, '.base64.txt')}...`);
      const b64 = toBase64SingleLine(ttfPath);
      writeFileSync(base64Path, `${b64}\n`, 'utf-8');
      generated++;
    } else {
      console.log(`✅ Found ${spec.fileName.replace(/\.ttf$/i, '.base64.txt')} (skip generate)`);
    }
  }

  console.log(`\nDone. Downloaded: ${downloaded}, Base64 generated: ${generated}`);
};

main().catch((err) => {
  console.error('❌ prepare-fonts failed:', err?.message || err);
  process.exit(1);
});
