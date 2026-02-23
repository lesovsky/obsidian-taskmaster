import esbuild from 'esbuild';
import esbuildSvelte from 'esbuild-svelte';
import sveltePreprocess from 'svelte-preprocess';
import { copyFileSync } from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isServe = process.argv.includes('--serve');

const options = {
  entryPoints: ['tests/harness/main.ts'],
  bundle: true,
  format: 'esm',
  outfile: 'tests/harness/harness.js',
  sourcemap: 'inline',
  logLevel: 'info',
  plugins: [
    // Replace 'obsidian' imports with our mock
    {
      name: 'obsidian-mock',
      setup(build) {
        build.onResolve({ filter: /^obsidian$/ }, () => ({
          path: path.resolve(__dirname, 'tests/harness/obsidian-mock.ts'),
        }));
      },
    },
    esbuildSvelte({
      preprocess: sveltePreprocess(),
      compilerOptions: { css: 'none' },
    }),
  ],
};

if (isServe) {
  // Copy styles.css once before serving
  copyFileSync('src/styles.css', 'tests/harness/styles.css');

  const ctx = await esbuild.context(options);
  await ctx.serve({ servedir: 'tests/harness', port: 5173 });
  console.log('Test harness running at http://localhost:5173');
} else {
  await esbuild.build(options);
  copyFileSync('src/styles.css', 'tests/harness/styles.css');
  process.exit(0);
}
