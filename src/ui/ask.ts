import { el } from './dom';

export interface AskAction<T extends string> {
  label: string;
  value: T;
  kind?: 'primary' | 'danger' | 'ghost';
}

/**
 * A small modal question with explicit buttons (instead of window.confirm, where "Cancel" can
 * mean different things). Native <dialog>: focus is trapped, Escape cancels. Resolves to the
 * chosen value, or null if dismissed.
 */
export function ask<T extends string>(opts: { title: string; body: string; actions: AskAction<T>[] }): Promise<T | null> {
  return new Promise((resolve) => {
    const dialog = el('dialog', { className: 'ask-dialog' });
    const finish = (value: T | null) => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    const buttons = opts.actions.map((a) => {
      const b = el('button', { type: 'button', className: `btn ${a.kind ?? ''}`.trim() }, a.label);
      b.addEventListener('click', () => finish(a.value));
      return b;
    });
    dialog.append(el('h2', {}, opts.title), el('p', {}, opts.body), el('div', { className: 'ask-dialog-actions' }, ...buttons));
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      finish(null);
    });
    document.body.append(dialog);
    dialog.showModal();
    // Focus the safest choice: the first (Cancel) button.
    buttons[0]?.focus();
  });
}

/** True while an ask() dialog is open (other Escape handlers should stand down). */
export const askOpen = () => !!document.querySelector('dialog.ask-dialog[open]');
