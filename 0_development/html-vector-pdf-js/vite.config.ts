import path from 'path';
import fs from 'fs/promises';
import { defineConfig, Plugin } from 'vite';

export default defineConfig(() => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [copyAssetsToDist()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      outDir: 'dist',
      lib: {
        entry: path.resolve(__dirname, 'services/pdfGenerator.ts'),
        name: 'html_to_vector_pdf',
        fileName: () => 'html_to_vector_pdf.js',
        formats: ['umd'] as any
      },
      rollupOptions: {
        output: {
          exports: 'named' as const,
          inlineDynamicImports: true
        }
      }
    }
  };
});

function rewriteDistScriptPath(html: string): string {
  const directPath = html.replaceAll('./dist/html_to_vector_pdf.js', './html_to_vector_pdf.js');
  return directPath.replace(
    /<script\s+src=(["'])\.\/html_to_vector_pdf\.js\1\s*><\/script>/g,
    '<script src="./html_to_vector_pdf.js"></script>'
  );
}

function copyAssetsToDist(): Plugin {
  return {
    name: 'copy-assets-to-dist',
    apply: 'build',
    async closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');

      try {
        const entries = await fs.readdir(__dirname, { withFileTypes: true });
        const filesToCopy = entries
          .filter((entry) =>
            entry.isFile() &&
            (entry.name.toLowerCase().endsWith('.html') ||
              entry.name.toLowerCase() === 'readme.md' ||
              entry.name.toLowerCase() === 'readme_zh.md')
          )
          .map((entry) => entry.name);

        await fs.mkdir(distDir, { recursive: true });

        await Promise.all(
          filesToCopy.map(async (fileName) => {
            const srcPath = path.resolve(__dirname, fileName);
            const outPath = path.resolve(distDir, fileName);

            if (fileName.toLowerCase().endsWith('.html')) {
              const html = await fs.readFile(srcPath, 'utf8');
              const rewritten = rewriteDistScriptPath(html);
              await fs.writeFile(outPath, rewritten, 'utf8');
            } else {
              await fs.copyFile(srcPath, outPath);
            }
          })
        );

        // If some build variants only output `html_to_vector_pdf_with_fonts.js`,
        // generate a small compatibility loader as `html_to_vector_pdf.js` so
        // existing demos/docs keep working.
        const expected = path.resolve(distDir, 'html_to_vector_pdf.js');
        const withFonts = path.resolve(distDir, 'html_to_vector_pdf_with_fonts.js');
        const expectedExists = await fs
          .access(expected)
          .then(() => true)
          .catch(() => false);
        const withFontsExists = await fs
          .access(withFonts)
          .then(() => true)
          .catch(() => false);

        if (!expectedExists && withFontsExists) {
          const loader = `/**
 * Compatibility loader
 *
 * Some builds in this repo output "html_to_vector_pdf_with_fonts.js" only.
 * Demos (and docs) expect "html_to_vector_pdf.js".
 *
 * This file loads the real bundle next to it, based on the current script URL.
 */
(function () {
  try {
    var base = (document.currentScript && document.currentScript.src) ? document.currentScript.src : window.location.href;
    var src = new URL('./html_to_vector_pdf_with_fonts.js', base).toString();

    var s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onerror = function () {
      console.error('[html_to_vector_pdf] Failed to load:', src);
    };
    document.head.appendChild(s);
  } catch (e) {
    console.error('[html_to_vector_pdf] Loader failed:', e);
  }
})();\n`;

          await fs.writeFile(expected, loader, 'utf8');
        }
      } catch (err) {
        console.warn('[copy-assets-to-dist] Skipped:', err);
      }
    }
  };
}
