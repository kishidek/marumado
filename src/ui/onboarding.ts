import { ShieldCheck, Sprout } from 'lucide';
import { CATALOG, DEFAULT_HABITS, intervalLabel, MAX_HABITS } from '../engine/catalog';
import { NAME_IDEAS } from '../engine/garden';
import type { FlowerColour, Settings, WorkHours } from '../engine/types';
import { $, el, icon, setBackgroundInert } from './dom';
import { habitIcon } from './icons';
import { daysPicker, flowerPicker, hoursPicker } from './pickers';
const STEPS = 5;

/**
 * First run. It can't be dismissed: nothing is saved until "Plant the seed",
 * so closing the tab halfway simply starts over next time.
 */
export function openOnboarding(onDone: (s: Settings, flowers: FlowerColour) => void) {
  let step = 0;
  let name = '';
  let flowers: FlowerColour = 'blue';
  const selected = new Set(DEFAULT_HABITS);
  const hours: WorkHours = { start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] };
  const next = $<HTMLButtonElement>('obNext');
  const back = $<HTMLButtonElement>('obBack');

  const render = () => {
    $('obSteps').replaceChildren(...Array.from({ length: STEPS }, (_, i) => el('li', { className: i <= step ? 'on' : '' })));
    back.style.visibility = step === 0 ? 'hidden' : 'visible';
    next.textContent = step === STEPS - 1 ? 'Plant the seed' : 'Continue';
    next.disabled = false;
    const body = $('obBody');

    if (step === 0) {
      body.replaceChildren(
        el('div', { className: 'hero-sprout' }, icon(Sprout, 32)),
        el('h2', { id: 'obTitle' }, 'Grow an ajisai while you work'),
        el(
          'p',
          {},
          'Each time you open a new tab, your ajisai may ask one quick question about a healthy habit. Keep it up and it grows, gets new pots, and blooms; after six months it moves to the garden and a new seed begins. Skip too often and it droops, but it never dies.',
        ),
      );
    } else if (step === 1) {
      const input = el('input', { type: 'text', className: 'name-input', value: name, maxLength: 24, placeholder: 'e.g. Aoi', ariaLabel: 'Plant name', autocomplete: 'off' });
      const sync = () => {
        name = input.value.trim();
        next.disabled = !name;
      };
      input.addEventListener('input', sync);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && name) next.click();
      });
      const ideas = el(
        'div',
        { className: 'days' },
        ...NAME_IDEAS.slice(0, 5).map((n) => {
          const b = el('button', { type: 'button', className: 'chip' }, n);
          b.addEventListener('click', () => {
            input.value = n;
            sync();
          });
          return b;
        }),
      );
      body.replaceChildren(
        el('h2', { id: 'obTitle' }, 'What will you call it?'),
        el('p', {}, 'Give your ajisai a name. It will greet you by it on every new tab.'),
        input,
        el('p', { className: 'note' }, 'Need an idea?'),
        ideas,
        el('p', { className: 'note' }, 'Flower colour'),
        flowerPicker(flowers, (c) => (flowers = c)),
      );
      sync();
    } else if (step === 2) {
      const counter = el('p', { className: 'counter' });
      const grid = el('div', { className: 'catalog' });
      const paint = () => {
        counter.textContent = `${selected.size} of ${MAX_HABITS} selected · start small, you can change this later`;
        grid.replaceChildren(
          ...CATALOG.map((h) => {
            const on = selected.has(h.id);
            const b = el(
              'button',
              { type: 'button', className: 'habit-option', disabled: !on && selected.size >= MAX_HABITS },
              icon(habitIcon(h.id), 20),
              el('span', {}, h.name),
              el('small', {}, intervalLabel(h.defaultIntervalMin)),
            );
            b.setAttribute('aria-pressed', String(on));
            b.addEventListener('click', () => {
              if (on) {
                if (selected.size > 1) selected.delete(h.id);
              } else selected.add(h.id);
              paint();
            });
            return b;
          }),
        );
      };
      paint();
      body.replaceChildren(el('h2', { id: 'obTitle' }, 'Pick your habits'), counter, grid);
    } else if (step === 3) {
      // Invalid choices are rejected on the spot (the control snaps back), same as in Settings.
      const error = el('p', { className: 'note' });
      body.replaceChildren(
        el('h2', { id: 'obTitle' }, 'When do you work?'),
        el('p', {}, `Questions only show up during these hours. Outside them, ${name} rests and loses nothing.`),
        hoursPicker(hours, (start, end) => {
          error.textContent = start === end ? 'Start and end can’t be the same.' : '';
          if (start === end) return false;
          hours.start = start;
          hours.end = end;
          return true;
        }),
        daysPicker(hours.days, (days) => {
          error.textContent = days.length ? '' : 'Keep at least one workday.';
          if (!days.length) return false;
          hours.days = days;
          return true;
        }),
        error,
      );
    } else {
      body.replaceChildren(
        el('div', { className: 'hero-sprout' }, icon(ShieldCheck, 32)),
        el('h2', { id: 'obTitle' }, 'Your data stays with you'),
        el(
          'p',
          {},
          'Everything is stored in this browser only. No account, no tracking, nothing sent anywhere. Export a backup from Settings now and then: if you uninstall the extension, the plant goes with it.',
        ),
      );
    }
  };

  next.onclick = () => {
    if (step < STEPS - 1) {
      step++;
      render();
      return;
    }
    $('onboarding').hidden = true;
    setBackgroundInert(false);
    onDone({
      plantName: name,
      habits: CATALOG.filter((h) => selected.has(h.id)).map((h) => ({ id: h.id, intervalMin: h.defaultIntervalMin })),
      workHours: hours,
      createdAt: Date.now(),
      vacations: [],
      reduceMotion: false,
      lastExportAt: null,
    }, flowers);
  };
  back.onclick = () => {
    step = Math.max(0, step - 1);
    render();
  };

  $('onboarding').hidden = false;
  setBackgroundInert(true);
  render();
  next.focus(); // Chrome may keep focus in the address bar; this helps once the page has it
}
