// Review sheet for the visual baselines: .output/TEMP - visual-baselines/index.html
// (a grid of every scene with its id; click an image to open it full size). Images are embedded
// as data URIs so the page works from any viewer, including editor previews that don't serve .output.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DIR = 'tests/e2e/visual/scenes.spec.ts-snapshots';
const OUT = '.output/TEMP - visual-baselines';
mkdirSync(OUT, { recursive: true });
const files = readdirSync(DIR).filter((f) => f.endsWith('.png')).sort();
if (!files.length) throw new Error(`No baselines in ${DIR}`);

// Scene titles from the spec: test('S07 · …', …)
const spec = readFileSync('tests/e2e/visual/scenes.spec.ts', 'utf8');
const titles = Object.fromEntries([...spec.matchAll(/scene\('(S\d+)',\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));

const cards = files.map((f) => {
  copyFileSync(path.join(DIR, f), path.join(OUT, f));
  const id = f.split('-')[0];
  const data = `data:image/png;base64,${readFileSync(path.join(DIR, f)).toString('base64')}`;
  return `<figure><img src="${data}" alt="${id}" onclick="show(this)"><figcaption><b>${id}</b> ${titles[id] ?? ''}</figcaption></figure>`;
});
writeFileSync(
  path.join(OUT, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Visual baselines</title>
<style>body{margin:24px;font:14px system-ui;background:#f4efe6;color:#2b2620}h1{font:600 22px Georgia,serif}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:20px}
figure{margin:0;background:#fff;border-radius:12px;padding:8px;box-shadow:0 4px 16px rgba(0,0,0,.08)}
img{width:100%;border-radius:8px;display:block;cursor:zoom-in}figcaption{padding:8px 4px 2px}
#big{position:fixed;inset:0;background:rgba(0,0,0,.85);display:none;place-items:center;cursor:zoom-out}#big img{max-width:95vw;max-height:95vh;width:auto}</style>
<div id="big" onclick="this.style.display='none'"><img></div><script>function show(i){const b=document.getElementById('big');b.firstChild.src=i.src;b.style.display='grid'}</script>
<h1>Marumado · visual baselines (${files.length})</h1><main>${cards.join('')}</main>`,
);
console.log(`${files.length} baselines → ${OUT}/index.html`);
