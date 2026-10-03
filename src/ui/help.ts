import { CircleHelp, X } from 'lucide';
import { $, el, icon, setBackgroundInert } from './dom';

/** "How Marumado works": a short explainer with a looping render of the plant's ages and moods. */
export function initHelp(opts: { plantName: () => string; reduceMotion: () => boolean; settingsOpen: () => boolean }) {
  const wrap = $('help');
  const video = $<HTMLVideoElement>('helpVideo');

  $('openHelp').append(icon(CircleHelp, 20));
  $('closeHelp').append(icon(X, 20));

  const open = () => {
    const name = opts.plantName();
    $('helpPoints').replaceChildren(
      ...[
        'Each new tab may ask one quick question about a healthy desk habit.',
        `Say “Yes” and ${name} grows: new leaves, bigger pots, blooms. Skip too often and it droops, but it never dies.`,
        'Questions only appear during your work hours. Outside them, and on vacation, nothing is lost.',
        'Everything stays in this browser. Back it up now and then from Settings.',
      ].map((t) => el('li', {}, t)),
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
  addEventListener('keydown', (e) => e.key === 'Escape' && close());
}
