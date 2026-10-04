import { Sprout } from 'lucide';
import { NAME_IDEAS, suggestName } from '../engine/garden';
import type { FlowerColour } from '../engine/types';
import { el, icon } from './dom';
import { flowerPicker } from './pickers';

let open: HTMLDialogElement | null = null;

/**
 * "<old> moved to the garden. Plant a new seed": name + flower colour (plans/002-garden.md §4.3).
 * Native <dialog>; it can't be dismissed without a choice (Escape keeps it open).
 */
export function openNewSeedDialog(opts: { moved: string; taken: string[]; defaultFlowers: FlowerColour; onDone: (name: string, flowers: FlowerColour) => void }) {
  if (open) return;
  let name = suggestName(opts.taken);
  let flowers = opts.defaultFlowers;
  const input = el('input', { type: 'text', className: 'name-input', value: name, maxLength: 24, ariaLabel: 'New plant name', autocomplete: 'off' });
  const plantBtn = el('button', { type: 'button', className: 'btn primary' }, 'Plant the seed');
  const sync = () => {
    name = input.value.trim();
    plantBtn.disabled = !name;
  };
  input.addEventListener('input', sync);
  input.addEventListener('keydown', (e) => e.key === 'Enter' && name && plantBtn.click());
  const ideas = el(
    'div',
    { className: 'days' },
    ...NAME_IDEAS.filter((n) => !opts.taken.includes(n))
      .slice(0, 5)
      .map((n) => {
        const b = el('button', { type: 'button', className: 'chip' }, n);
        b.addEventListener('click', () => {
          input.value = n;
          sync();
        });
        return b;
      }),
  );
  const dialog = el(
    'dialog',
    { className: 'ask-dialog new-seed' },
    el('div', { className: 'hero-sprout' }, icon(Sprout, 30)),
    el('h2', {}, `${opts.moved} moved to the garden`),
    el('p', {}, 'Six months of care. It will keep growing out there. Now plant a new seed:'),
    input,
    ideas,
    el('p', { className: 'note' }, 'Flower colour'),
    flowerPicker(flowers, (c) => (flowers = c)),
    el('div', { className: 'ask-dialog-actions' }, plantBtn),
  );
  dialog.addEventListener('cancel', (e) => e.preventDefault());
  plantBtn.addEventListener('click', () => {
    if (!name) return;
    closeNewSeedDialog();
    opts.onDone(name, flowers);
  });
  document.body.append(dialog);
  dialog.showModal();
  open = dialog;
  input.select();
}

/** Closes the dialog (also when another tab answered it). */
export function closeNewSeedDialog() {
  open?.close();
  open?.remove();
  open = null;
}

export const newSeedOpen = () => !!open;
