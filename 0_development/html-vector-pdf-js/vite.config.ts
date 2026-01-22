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
      } catch (err) {
        console.warn('[copy-assets-to-dist] Skipped:', err);
      }
    }
  };
}
