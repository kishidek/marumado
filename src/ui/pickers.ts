import { FLOWER_COLOURS, type FlowerColour, type WorkHours } from '../engine/types';
import { el } from './dom';

const WEEK = [
  { d: 1, label: 'Mon' },
  { d: 2, label: 'Tue' },
  { d: 3, label: 'Wed' },
  { d: 4, label: 'Thu' },
  { d: 5, label: 'Fri' },
  { d: 6, label: 'Sat' },
  { d: 0, label: 'Sun' },
];

/**
 * Start/end time inputs. `onChange` returns false to reject a value; the inputs then snap back
 * to the last accepted one, so what's shown always matches what's saved. An end before the start
 * is an overnight shift, and the hint says so.
 */
export function hoursPicker(wh: Pick<WorkHours, 'start' | 'end'>, onChange: (start: string, end: string) => boolean) {
  const start = el('input', { type: 'time', value: wh.start, ariaLabel: 'Work starts' });
  const end = el('input', { type: 'time', value: wh.end, ariaLabel: 'Work ends' });
  const hint = el('p', { className: 'hours-hint' });
  let accepted = { start: wh.start, end: wh.end };
  const paintHint = () => (hint.textContent = accepted.end < accepted.start ? `Overnight shift: ends at ${accepted.end} the next morning.` : '');
  const emit = () => {
    if (!start.value || !end.value) return;
    if (onChange(start.value, end.value)) {
      accepted = { start: start.value, end: end.value };
    } else {
      start.value = accepted.start;
      end.value = accepted.end;
    }
    paintHint();
  };
  start.addEventListener('change', emit);
  end.addEventListener('change', emit);
  paintHint();
  return el('div', {}, el('div', { className: 'hours' }, start, '→', end), hint);
}

/** Weekday toggles. `onChange` returns false to reject (e.g. no days left); the toggle then reverts. */
export function daysPicker(days: number[], onChange: (days: number[]) => boolean) {
  const current = new Set(days);
  return el(
    'div',
    { className: 'days', role: 'group', ariaLabel: 'Workdays' },
    ...WEEK.map(({ d, label }) => {
      const b = el('button', { type: 'button' }, label);
      b.setAttribute('aria-pressed', String(current.has(d)));
      b.addEventListener('click', () => {
        const had = current.has(d);
        if (had) current.delete(d);
        else current.add(d);
        if (!onChange([...current].sort())) {
          if (had) current.add(d);
          else current.delete(d);
        }
        b.setAttribute('aria-pressed', String(current.has(d)));
      });
      return b;
    }),
  );
}

const FLOWER_LABELS: Record<FlowerColour, { label: string; swatch: string }> = {
  blue: { label: 'Blue', swatch: '#5b6fd6' },
  violet: { label: 'Violet', swatch: '#9b5fc9' },
  pink: { label: 'Pink', swatch: '#e07a9a' },
  white: { label: 'White', swatch: '#efe9dc' },
};

/** Four hydrangea colours as swatch buttons (onboarding and the new-seed dialog). */
export function flowerPicker(value: FlowerColour, onChange: (c: FlowerColour) => void) {
  const group = el('div', { className: 'flowers', role: 'radiogroup', ariaLabel: 'Flower colour' });
  const paint = (current: FlowerColour) => {
    group.replaceChildren(
      ...FLOWER_COLOURS.map((c) => {
        const b = el('button', { type: 'button', className: 'flower', role: 'radio' }, el('span', { className: 'swatch' }), FLOWER_LABELS[c].label);
        (b.firstElementChild as HTMLElement).style.background = FLOWER_LABELS[c].swatch;
        b.setAttribute('aria-checked', String(c === current));
        b.addEventListener('click', () => {
          onChange(c);
          paint(c);
        });
        return b;
      }),
    );
  };
  paint(value);
  return group;
}
