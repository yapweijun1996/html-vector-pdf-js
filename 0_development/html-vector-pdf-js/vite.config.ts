import path from 'path';
import fs from 'fs/promises';
import { defineConfig, Plugin } from 'vite';

const ROOT_DIR = __dirname;
const ROOT_DIST_DIR = path.resolve(ROOT_DIR, 'dist');
const TEMPLATES_SRC_DIR = path.resolve(ROOT_DIR, 'templates');
const TEMPLATES_DIST_DIR = path.resolve(ROOT_DIST_DIR, 'templates');
const SAMPLE_PRINTFORM_DIST_PATH = path.resolve(
  ROOT_DIR,
  'sample-project/printform-js/dist/printform.js'
);

export default defineConfig(() => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [servePrintformFromSampleDist(), copyAssetsToDist()],
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

// Templates live in dist/templates/ — strip the extra /dist/ segment from their asset paths
function rewriteTemplatePaths(html: string): string {
  return html
    .replaceAll('../dist/html_to_vector_pdf.js', '../html_to_vector_pdf.js')
    .replaceAll('../dist/printform.js', '../printform.js');
}

function servePrintformFromSampleDist(): Plugin {
  return {
    name: 'serve-printform-from-sample-dist',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlPath = req.url ? req.url.split('?')[0] : '';
        if (urlPath !== '/dist/printform.js') {
          next();
          return;
        }

        try {
          const contents = await fs.readFile(SAMPLE_PRINTFORM_DIST_PATH, 'utf8');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.end(contents);
        } catch (err: any) {
          console.warn(
            `[serve-printform-from-sample-dist] Missing sample printform bundle: ${SAMPLE_PRINTFORM_DIST_PATH}`
          );
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(
            `Missing sample-project/printform-js/dist/printform.js.\nExpected path: ${SAMPLE_PRINTFORM_DIST_PATH}\n` +
            'Build the sample printform bundle before loading templates from the root dev server.'
          );
        }
      });
    }
  };
}

function copyAssetsToDist(): Plugin {
  return {
    name: 'copy-assets-to-dist',
    apply: 'build',
    async closeBundle() {
      try {
        const entries = await fs.readdir(ROOT_DIR, { withFileTypes: true });
        const filesToCopy = entries
          .filter((entry) =>
            entry.isFile() &&
            (entry.name.toLowerCase().endsWith('.html') ||
              entry.name.toLowerCase() === 'readme.md' ||
              entry.name.toLowerCase() === 'readme_zh.md')
          )
          .map((entry) => entry.name);

        await fs.mkdir(ROOT_DIST_DIR, { recursive: true });

        await Promise.all(
          filesToCopy.map(async (fileName) => {
            const srcPath = path.resolve(ROOT_DIR, fileName);
            const outPath = path.resolve(ROOT_DIST_DIR, fileName);

            if (fileName.toLowerCase().endsWith('.html')) {
              const html = await fs.readFile(srcPath, 'utf8');
              const rewritten = rewriteDistScriptPath(html);
              await fs.writeFile(outPath, rewritten, 'utf8');
            } else {
              await fs.copyFile(srcPath, outPath);
            }
          })
        );

        // Copy static assets needed by templates
        const staticAssets = ['template-base.css', 'template-base.js', 'favicon.svg'];
        await Promise.all(
          staticAssets.map(async (fileName) => {
            const srcPath = path.resolve(ROOT_DIR, fileName);
            try {
              await fs.copyFile(srcPath, path.resolve(ROOT_DIST_DIR, fileName));
            } catch {
              console.warn(`[copy-assets-to-dist] Skipped missing asset: ${fileName}`);
            }
          })
        );

        // Copy templates/ directory to dist/templates/ with path rewriting
        try {
          const templateFiles = await fs.readdir(TEMPLATES_SRC_DIR, { withFileTypes: true });
          await fs.mkdir(TEMPLATES_DIST_DIR, { recursive: true });
          await Promise.all(
            templateFiles
              .filter((entry) => entry.isFile())
              .map(async (entry) => {
                const srcPath = path.resolve(TEMPLATES_SRC_DIR, entry.name);
                const outPath = path.resolve(TEMPLATES_DIST_DIR, entry.name);
                if (entry.name.toLowerCase().endsWith('.html')) {
                  const html = await fs.readFile(srcPath, 'utf8');
                  await fs.writeFile(outPath, rewriteTemplatePaths(html), 'utf8');
                } else {
                  await fs.copyFile(srcPath, outPath);
                }
              })
          );
        } catch (err: any) {
          console.warn('[copy-assets-to-dist] Failed to copy templates:', err);
        }

        try {
          await fs.copyFile(
            SAMPLE_PRINTFORM_DIST_PATH,
            path.resolve(ROOT_DIST_DIR, 'printform.js')
          );
        } catch (err: any) {
          console.warn(
            `[copy-assets-to-dist] Missing sample printform bundle: ${SAMPLE_PRINTFORM_DIST_PATH}`
          );
        }
      } catch (err) {
        console.warn('[copy-assets-to-dist] Skipped:', err);
      }
    }
  };
}
