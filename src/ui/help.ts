import { CircleHelp, X } from 'lucide';
import { askOpen } from './ask';
import { $, el, icon, setBackgroundInert } from './dom';

/**
 * "How Marumado works": four steps, each a short looping clip of the real scene rendered by
 * `npm run render:help` (tests/e2e/clips/help-clips.spec.ts). Reduce motion shows stills.
 */
const STEPS = [
  { clip: 'help-1', title: 'One quick question', text: 'on each new tab, only during your work hours. Answer Yes, Not yet or Later.' },
  { clip: 'help-2', title: 'Say Yes and it grows', text: 'new leaves, bigger pots, then blooms. About 6 months of care to its full size.' },
  { clip: 'help-3', title: 'Skip it and it droops', text: 'but it never dies: a few days of care always bring it back.' },
  { clip: 'help-4', title: 'After 6 months, to the garden', text: 'it flies out through the window and keeps growing there. A new seed begins, with the colour you pick.' },
];

export function initHelp(opts: { plantName: () => string; reduceMotion: () => boolean; settingsOpen: () => boolean }) {
  const wrap = $('help');
  const stepsEl = $('helpSteps');
  const dots = $('helpDots');
  const prev = $<HTMLButtonElement>('helpPrev');
  const next = $<HTMLButtonElement>('helpNext');
  let index = 0;
  let built = false;

  $('openHelp').append(icon(CircleHelp, 20));
  $('closeHelp').append(icon(X, 20));

  const still = () => opts.reduceMotion() || matchMedia('(prefers-reduced-motion: reduce)').matches;

  function build() {
    // Media is created on first open only: nothing loads until the user asks for help.
    built = true;
    stepsEl.replaceChildren(
      ...STEPS.map((s, i) => {
        const media = still()
          ? el('img', { src: `media/${s.clip}.jpg`, alt: '' })
          : el('video', { src: `media/${s.clip}.webm`, poster: `media/${s.clip}.jpg`, muted: true, loop: true, playsInline: true, preload: i === 0 ? 'auto' : 'none' });
        return el(
          'section',
          { className: 'help-step', role: 'tabpanel', ariaLabel: `Step ${i + 1} of ${STEPS.length}` },
          el('div', { className: 'help-media' }, media),
          el('p', { className: 'help-line' }, el('span', { className: 'help-num' }, String(i + 1)), el('b', {}, s.title), `, ${s.text}`),
        );
      }),
    );
    dots.replaceChildren(
      ...STEPS.map((s, i) => {
        const d = el('button', { type: 'button', className: 'help-dot', role: 'tab', ariaLabel: `Step ${i + 1}: ${s.title}` });
        d.addEventListener('click', () => go(i));
        return d;
      }),
    );
  }

  function go(i: number) {
    index = (i + STEPS.length) % STEPS.length;
    [...stepsEl.children].forEach((step, j) => {
      const on = j === index;
      step.toggleAttribute('hidden', !on);
      const v = step.querySelector('video');
      if (!v) return;
      if (on) {
        v.currentTime = 0;
        void v.play().catch(() => undefined);
      } else v.pause();
    });
    [...dots.children].forEach((d, j) => d.setAttribute('aria-selected', String(j === index)));
    prev.style.visibility = index === 0 ? 'hidden' : 'visible';
    next.textContent = index === STEPS.length - 1 ? 'Got it' : 'Next →';
  }

  const open = () => {
    if (!built) build();
    wrap.hidden = false;
    setBackgroundInert(true);
    go(0);
    next.focus();
  };

  const close = () => {
    if (wrap.hidden) return;
    wrap.hidden = true;
    stepsEl.querySelectorAll('video').forEach((v) => v.pause());
    setBackgroundInert(opts.settingsOpen());
  };

  prev.addEventListener('click', () => go(index - 1));
  next.addEventListener('click', () => (index === STEPS.length - 1 ? close() : go(index + 1)));
  $('openHelp').addEventListener('click', open);
  $('closeHelp').addEventListener('click', close);
  wrap.addEventListener('click', (e) => e.target === wrap && close());
  addEventListener('keydown', (e) => {
    if (wrap.hidden || askOpen()) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') go(index + 1);
    if (e.key === 'ArrowLeft') go(index - 1);
  });
}
