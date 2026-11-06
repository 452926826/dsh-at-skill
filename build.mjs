import { build } from 'esbuild';

await Promise.all([
  build({ entryPoints: ['src/index.ts'], outfile: 'lib/index.js', bundle: true, packages: 'external', platform: 'node', format: 'esm', target: 'node20' }),
  build({
    entryPoints: ['src/client/index.ts'], outfile: 'lib/client.js', bundle: true,
    packages: 'external', platform: 'browser', format: 'cjs', target: 'es2022', sourcemap: true,
    banner: { js: 'window.__ModuleLoader__.load({ id: "dsh-at-skill", factory: (require) => { var module = { exports: {} }; var exports = module.exports;' },
    footer: { js: 'return module.exports; } });' },
  }),
]);
