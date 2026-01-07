import path from 'path';
import fs from 'fs/promises';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), copyHtmlDemosToDist()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      outDir: 'dist',
      lib: {
        entry: path.resolve(__dirname, 'services/pdfGenerator.ts'),
        name: 'Globe3PdfGenerator',
        fileName: () => 'globe3-pdf.js',
        formats: ['umd']
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
  const directPath = html.replaceAll('./dist/globe3-pdf.js', './globe3-pdf.js');
  return directPath.replace(
    /<script\s+src=(["'])\.\/globe3-pdf\.js\1\s*><\/script>/g,
    '<script src="./globe3-pdf.js"></script>'
  );
}

function copyHtmlDemosToDist(): Plugin {
  return {
    name: 'copy-html-demos-to-dist',
    apply: 'build',
    async closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');

      try {
        const entries = await fs.readdir(__dirname, { withFileTypes: true });
        const htmlFiles = entries
          .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
          .map((entry) => entry.name);

        await fs.mkdir(distDir, { recursive: true });

        await Promise.all(
          htmlFiles.map(async (fileName) => {
            const srcPath = path.resolve(__dirname, fileName);
            const outPath = path.resolve(distDir, fileName);
            const html = await fs.readFile(srcPath, 'utf8');
            const rewritten = rewriteDistScriptPath(html);
            await fs.writeFile(outPath, rewritten, 'utf8');
          })
        );
      } catch (err) {
        console.warn('[copy-html-demos-to-dist] Skipped:', err);
      }
    }
  };
}
