// Cache-busting for GitHub Pages (which caches files ~10 min). Run by CI on the assembled _site/:
//   node scripts/stamp-version.mjs _site <version>
// - every relative ES-module import gets ?v=<version>, so a deploy never mixes old + new modules
// - index.html: main.js / app.css get ?v=, <meta name="app-version"> gets the version
// - writes version.json, which the app polls (no-store) to reload when a newer deploy is live
// - sw.js: VERSION (cache name) + PRECACHE (shell, css, every module) for offline use
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [dir = '_site', version = Date.now().toString(36)] = process.argv.slice(2);
const v = encodeURIComponent(version);

async function* jsFiles(d) {
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) yield* jsFiles(p);
    else if (e.name.endsWith('.js')) yield p;
  }
}

let n = 0;
for await (const f of jsFiles(join(dir, 'src'))) {
  const src = await readFile(f, 'utf8');
  const out = src.replace(/((?:\bfrom|\bimport)\s*\(?\s*)(['"])(\.{1,2}\/[^'"?]+\.js)\2/g, (_m, pre, q, path) => `${pre}${q}${path}?v=${v}${q}`);
  if (out !== src) { await writeFile(f, out); n++; }
}

const htmlPath = join(dir, 'index.html');
const html = (await readFile(htmlPath, 'utf8'))
  .replace('src="src/main.js"', `src="src/main.js?v=${v}"`)
  .replace('href="css/app.css"', `href="css/app.css?v=${v}"`)
  .replace('<meta name="app-version" content="dev">', `<meta name="app-version" content="${version}">`);
await writeFile(htmlPath, html);

// service worker: per-deploy cache name + offline precache list
const precache = ['./', `css/app.css?v=${v}`, 'manifest.webmanifest', 'data/discover.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/icon.svg'];
for await (const f of jsFiles(join(dir, 'src'))) precache.push(`${f.slice(dir.length + 1).replace(/\\/g, '/')}?v=${v}`);
const swPath = join(dir, 'sw.js');
const sw = (await readFile(swPath, 'utf8'))
  .replace("const VERSION = 'dev';", `const VERSION = ${JSON.stringify(version)};`)
  .replace('const PRECACHE = [];', `const PRECACHE = ${JSON.stringify(precache)};`);
await writeFile(swPath, sw);
await writeFile(join(dir, 'version.json'), JSON.stringify({ version }));
console.log(`stamped ${n} modules + index.html + sw.js (${precache.length} precached) with v=${version}`);
