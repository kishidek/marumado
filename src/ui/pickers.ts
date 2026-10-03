import type { WorkHours } from '../engine/types';
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

export function hoursPicker(wh: Pick<WorkHours, 'start' | 'end'>, onChange: (start: string, end: string) => void) {
  const start = el('input', { type: 'time', value: wh.start, ariaLabel: 'Work starts' });
  const end = el('input', { type: 'time', value: wh.end, ariaLabel: 'Work ends' });
  const emit = () => start.value && end.value && onChange(start.value, end.value);
  start.addEventListener('change', emit);
  end.addEventListener('change', emit);
  return el('div', { className: 'hours' }, start, '→', end);
}

export function daysPicker(days: number[], onChange: (days: number[]) => void) {
  const current = new Set(days);
  return el(
    'div',
    { className: 'days', role: 'group', ariaLabel: 'Workdays' },
    ...WEEK.map(({ d, label }) => {
      const b = el('button', { type: 'button' }, label);
      b.setAttribute('aria-pressed', String(current.has(d)));
      b.addEventListener('click', () => {
        if (current.has(d)) current.delete(d);
        else current.add(d);
        b.setAttribute('aria-pressed', String(current.has(d)));
        onChange([...current].sort());
      });
      return b;
    }),
  );
}
