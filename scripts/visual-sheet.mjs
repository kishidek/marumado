// Review sheet for the visual baselines: .output/TEMP - visual-baselines/index.html
// (a grid of every scene with its id; click an image to open it full size).
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DIR = 'tests/e2e/visual/scenes.spec.ts-snapshots';
const OUT = '.output/TEMP - visual-baselines';
mkdirSync(OUT, { recursive: true });
const files = readdirSync(DIR).filter((f) => f.endsWith('.png')).sort();
if (!files.length) throw new Error(`No baselines in ${DIR}`);

// Scene titles from the spec: test('S07 · …', …)
const spec = readFileSync('tests/e2e/visual/scenes.spec.ts', 'utf8');
const titles = Object.fromEntries([...spec.matchAll(/test\('(S\d+) · ([^']+)'/g)].map((m) => [m[1], m[2]]));

const cards = files.map((f) => {
  copyFileSync(path.join(DIR, f), path.join(OUT, f));
  const id = f.split('-')[0];
  return `<figure><a href="${f}" target="_blank"><img src="${f}" alt="${id}"></a><figcaption><b>${id}</b> ${titles[id] ?? ''}</figcaption></figure>`;
});
writeFileSync(
  path.join(OUT, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Visual baselines</title>
<style>body{margin:24px;font:14px system-ui;background:#f4efe6;color:#2b2620}h1{font:600 22px Georgia,serif}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:20px}
figure{margin:0;background:#fff;border-radius:12px;padding:8px;box-shadow:0 4px 16px rgba(0,0,0,.08)}
img{width:100%;border-radius:8px;display:block}figcaption{padding:8px 4px 2px}</style>
<h1>Marumado · visual baselines (${files.length})</h1><main>${cards.join('')}</main>`,
);
console.log(`${files.length} baselines → ${OUT}/index.html`);
