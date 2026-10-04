import { CircleHelp, X } from 'lucide';
import { askOpen } from './ask';
import { $, el, icon, setBackgroundInert } from './dom';

/** "How Marumado works": a short explainer with a looping render of the plant's ages and moods. */
export function initHelp(opts: { plantName: () => string; reduceMotion: () => boolean; settingsOpen: () => boolean }) {
  const wrap = $('help');
  const video = $<HTMLVideoElement>('helpVideo');

  $('openHelp').append(icon(CircleHelp, 20));
  $('closeHelp').append(icon(X, 20));

  const open = () => {
    const name = opts.plantName();
    const tile = (key: string, detail: string) => el('li', {}, el('strong', {}, key), el('span', {}, detail));
    $('helpPoints').replaceChildren(
      tile('One quick question', 'on each new tab'),
      tile('Say Yes', `and ${name} grows`),
      tile('Skip it', 'and it droops'),
      tile('It never dies', 'care brings it back'),
      tile('Only at work', 'no questions after hours'),
      tile('Stays in this browser', 'back it up in Settings'),
    );
    wrap.hidden = false;
    setBackgroundInert(true);
    const still = opts.reduceMotion() || matchMedia('(prefers-reduced-motion: reduce)').matches;
    video.controls = still;
    if (!still) void video.play().catch(() => (video.controls = true));
    $('closeHelp').focus();
  };

  const close = () => {
    if (wrap.hidden) return;
    wrap.hidden = true;
    video.pause();
    setBackgroundInert(opts.settingsOpen());
  };

  $('openHelp').addEventListener('click', open);
  $('closeHelp').addEventListener('click', close);
  wrap.addEventListener('click', (e) => e.target === wrap && close());
  addEventListener('keydown', (e) => e.key === 'Escape' && !askOpen() && close());
}
