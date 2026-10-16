import { build } from 'esbuild';
await build({entryPoints:['src/server.ts'],outfile:'dist/server.mjs',bundle:true,packages:'external',platform:'node',target:'node22',format:'esm',sourcemap:true});
