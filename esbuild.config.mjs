import esbuild from 'esbuild';
import esbuildSvelte from 'esbuild-svelte';
import sveltePreprocess from 'svelte-preprocess';
import { copyFileSync } from 'fs';
import process from 'process';

const prod = process.argv[2] === 'production';

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian'],
  format: 'cjs',
  target: 'es2021',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
  minify: prod,
  plugins: [
    esbuildSvelte({
      preprocess: sveltePreprocess(),
      compilerOptions: {
        css: 'none',
      },
    }),
  ],
});

if (prod) {
  await context.rebuild();
  copyFileSync('src/styles.css', 'styles.css');
  process.exit(0);
} else {
  await context.watch();
}
