import path from 'path';
import fs from 'fs/promises';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), copyTestHtmlToDist()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
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
            exports: 'named',
            inlineDynamicImports: true
          }
        }
      }
    };
});

function copyTestHtmlToDist() {
  return {
    name: 'copy-test-html-to-dist',
    apply: 'build',
    async closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const srcPath = path.resolve(__dirname, 'test.html');
      const outPath = path.resolve(distDir, 'test.html');

      try {
        const html = await fs.readFile(srcPath, 'utf8');
        const rewritten = html.replace(
          '<script src="./dist/globe3-pdf.js"></script>',
          '<script src="./globe3-pdf.js"></script>'
        );
        await fs.mkdir(distDir, { recursive: true });
        await fs.writeFile(outPath, rewritten, 'utf8');
      } catch (err) {
        console.warn('[copy-test-html-to-dist] Skipped:', err);
      }
    }
  };
}
