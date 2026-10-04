import { ShieldCheck, X } from 'lucide';
import { makeBackup, parseBackup } from '../engine/backup';
import { CATALOG, catalogHabit, intervalLabel, intervalOptionsFor, MAX_HABITS, MIN_HABITS } from '../engine/catalog';
import type { Checkpoint } from '../engine/model';
import type { AnswerEvent, Settings } from '../engine/types';
import { clearAll, errorsItem, replaceAll, saveSettings } from '../storage/items';
import { ask, askOpen } from './ask';
import { $, el, icon, relativeTime, setBackgroundInert, toast } from './dom';
import { habitIcon } from './icons';
import { daysPicker, hoursPicker } from './pickers';

interface Ctx {
  getSettings: () => Settings | null;
  getEvents: () => AnswerEvent[];
  getCheckpoint: () => Checkpoint | null;
}

let ctx: Ctx;

export function initSettings(c: Ctx) {
  ctx = c;
  const close = $('settings').querySelector<HTMLButtonElement>('[data-close]')!;
  close.append(icon(X, 20));
  close.addEventListener('click', () => openSettings(false));
  $('settingsScrim').addEventListener('click', () => openSettings(false));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !askOpen()) openSettings(false);
  });
  // A refresh skipped while the user was typing runs once they leave the field.
  $('settings').addEventListener('focusout', () => {
    if (pendingRefresh) queueMicrotask(refreshSettings);
  });
}

export function openSettings(open: boolean) {
  const wasOpen = settingsOpen();
  if (open) render();
  $('settings').hidden = !open;
  $('settingsScrim').hidden = !open;
  setBackgroundInert(open || !$('onboarding').hidden); // onboarding may have opened underneath (start over)
  if (open) $('settings').querySelector<HTMLElement>('[data-close]')!.focus();
  else if (wasOpen && !$('openSettings').hidden) $('openSettings').focus(); // give focus back to the gear
}

export const settingsOpen = () => !$('settings').hidden;

let pendingRefresh = false;

/**
 * Called whenever stored data changes (this tab or another). Re-renders the open drawer so it
 * always shows what's saved, except while the user is typing in it (that refresh waits for blur).
 */
export function refreshSettings() {
  if (!settingsOpen()) return;
  const active = document.activeElement;
  if (active instanceof HTMLInputElement && (active.type === 'text' || active.type === 'time') && $('settings').contains(active)) {
    pendingRefresh = true;
    return;
  }
  pendingRefresh = false;
  const body = $('settingsBody');
  const scroll = body.scrollTop;
  render();
  body.scrollTop = scroll;
}

function toggleRow(label: string, sub: string, checked: boolean, onChange: (on: boolean) => void) {
  const input = el('input', { type: 'checkbox', checked });
  input.addEventListener('change', () => onChange(input.checked));
  return el('label', { className: 'setting-row' }, el('span', { className: 'grow' }, label, el('small', {}, sub)), input);
}

export async function downloadBackup(settings: Settings, events: AnswerEvent[], checkpoint: Checkpoint | null) {
  const now = Date.now();
  const diagnostics = await errorsItem.getValue().catch(() => []);
  const blob = new Blob([JSON.stringify(makeBackup(settings, events, now, diagnostics, checkpoint), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const date = new Date(now).toISOString().slice(0, 10);
  // Non-Latin names (e.g. kanji) would slug to nothing: fall back to "plant".
  const slug = settings.plantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'plant';
  el('a', { href: url, download: `marumado-${slug}-${date}.json` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  await saveSettings((s) => ({ ...s, lastExportAt: now }));
}

/** Handlers run later than render(): always read the latest settings, never the render-time copy. */
const current = () => ctx.getSettings()!;
const backupNow = () => downloadBackup(current(), ctx.getEvents(), ctx.getCheckpoint());

function render() {
  const s = ctx.getSettings();
  if (!s) return;
  const active = s.habits;

  // --- Your plant (Enter or the button saves)
  const nameInput = el('input', { type: 'text', className: 'rename-input', value: s.plantName, maxLength: 24, ariaLabel: 'Plant name' });
  const renameBtn = el('button', { type: 'button', className: 'btn' }, 'Rename');
  const rename = async () => {
    const name = nameInput.value.trim();
    if (!name || name === current().plantName) return;
    await saveSettings((x) => ({ ...x, plantName: name }));
    toast(`Your plant is now called ${name}.`);
  };
  renameBtn.addEventListener('click', () => void rename());
  nameInput.addEventListener('keydown', (e) => e.key === 'Enter' && void rename());

  // --- Habits (the drawer re-renders itself when the saved list changes)
  const habitRows = active.map((h) => {
    const meta = catalogHabit(h.id)!;
    const options = intervalOptionsFor(h.id);
    const select = el(
      'select',
      { ariaLabel: `${meta.name} interval`, disabled: options.length === 1 },
      ...options.map((m) => el('option', { value: String(m), selected: m === h.intervalMin }, intervalLabel(m))),
    );
    select.addEventListener('change', () =>
      saveSettings((x) => ({ ...x, habits: x.habits.map((y) => (y.id === h.id ? { ...y, intervalMin: Number(select.value) } : y)) })),
    );
    const remove = el('button', { type: 'button', className: 'btn ghost', disabled: active.length <= MIN_HABITS }, 'Remove');
    remove.addEventListener('click', async () => {
      const ok = await ask({
        title: `Remove ${meta.name}?`,
        body: 'Its progress so far stays in your plant. If you add it back later, it starts fresh.',
        actions: [
          { label: 'Cancel', value: 'cancel', kind: 'ghost' },
          { label: 'Remove', value: 'remove', kind: 'danger' },
        ],
      });
      if (ok === 'remove') await saveSettings((x) => ({ ...x, habits: x.habits.filter((y) => y.id !== h.id) }));
    });
    return el('div', { className: 'setting-row' }, icon(habitIcon(h.id), 20), el('span', { className: 'grow' }, meta.name, el('small', {}, meta.plantPart)), select, remove);
  });
  const addable = CATALOG.filter((c) => !active.some((h) => h.id === c.id));
  const addChips = addable.map((c) => {
    const b = el('button', { type: 'button', className: 'chip', disabled: active.length >= MAX_HABITS }, `+ ${c.name}`);
    b.addEventListener('click', () =>
      saveSettings((x) =>
        x.habits.length >= MAX_HABITS || x.habits.some((y) => y.id === c.id)
          ? x
          : { ...x, habits: [...x.habits, { id: c.id, intervalMin: c.defaultIntervalMin, addedAt: Date.now() }] },
      ),
    );
    return b;
  });

  // --- Work hours (invalid input is rejected and the control snaps back)
  const hoursError = el('p', { className: 'note' });
  const hours = hoursPicker(s.workHours, (start, end) => {
    hoursError.textContent = start === end ? 'Start and end can’t be the same.' : '';
    if (start === end) return false;
    void saveSettings((x) => ({ ...x, workHours: { ...x.workHours, start, end } }));
    return true;
  });
  const days = daysPicker(s.workHours.days, (d) => {
    hoursError.textContent = d.length ? '' : 'Keep at least one workday.';
    if (!d.length) return false;
    void saveSettings((x) => ({ ...x, workHours: { ...x.workHours, days: d } }));
    return true;
  });

  // --- Data
  const onVacation = s.vacations.some((v) => v.to === null);
  const exportBtn = el('button', { type: 'button', className: 'btn primary' }, 'Export backup');
  exportBtn.addEventListener('click', async () => {
    await backupNow();
    toast('Backup downloaded.');
  });
  const file = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    const parsed = parseBackup(await f.text());
    if (!parsed.ok) {
      toast(parsed.error);
      return;
    }
    const b = parsed.backup;
    const ok = await ask({
      title: `Restore ${b.settings.plantName}?`,
      body: `This replaces ${current().plantName} with the backup (${b.events.length} answers). Export ${current().plantName} first if you want to keep it.`,
      actions: [
        { label: 'Cancel', value: 'cancel', kind: 'ghost' },
        { label: 'Restore', value: 'restore', kind: 'primary' },
      ],
    });
    if (ok !== 'restore') return;
    await replaceAll(b.settings, b.events, b.checkpoint ?? null);
    toast(`${b.settings.plantName} is back.`);
  });
  const importBtn = el('button', { type: 'button', className: 'btn' }, 'Restore from file');
  importBtn.addEventListener('click', () => file.click());

  // One dialog with explicit choices (two confirm()s made "Cancel" mean "erase anyway").
  const startOver = el('button', { type: 'button', className: 'btn danger' }, 'Start over…');
  startOver.addEventListener('click', async () => {
    const name = current().plantName;
    const choice = await ask({
      title: 'Start over with a new seed?',
      body: `${name}'s history will be erased from this browser. This can't be undone.`,
      actions: [
        { label: 'Cancel', value: 'cancel', kind: 'ghost' },
        { label: 'Erase without backup', value: 'erase', kind: 'danger' },
        { label: 'Download backup & erase', value: 'backup', kind: 'primary' },
      ],
    });
    if (choice !== 'erase' && choice !== 'backup') return;
    if (choice === 'backup') await backupNow();
    await clearAll();
    openSettings(false);
  });

  const diagnosticsRow = el('div', { className: 'setting-row', id: 'diagnostics' });
  $('settingsBody').replaceChildren(
    el('h3', {}, 'Your plant'),
    el('div', { className: 'setting-row' }, nameInput, renameBtn),

    el('h3', {}, `Habits · ${active.length} of ${MAX_HABITS}`),
    ...habitRows,
    ...(addable.length ? [el('p', { className: 'note' }, active.length >= MAX_HABITS ? 'Remove one to add another.' : `Add one (${MAX_HABITS - active.length} left):`), el('div', { className: 'days' }, ...addChips)] : []),
    el('p', { className: 'note' }, 'Changes apply from today on. Past days keep the settings they had.'),

    el('h3', {}, 'Work hours'),
    hours,
    days,
    hoursError,
    el('p', { className: 'note' }, `Questions only appear during these hours. ${s.plantName} never loses health outside them.`),

    el('h3', {}, 'Away'),
    toggleRow('Vacation mode', 'Pause questions and health while you’re away.', onVacation, (on) =>
      saveSettings((x) => ({
        ...x,
        vacations: on
          ? x.vacations.some((v) => v.to === null) // already on (e.g. from another tab)
            ? x.vacations
            : [...x.vacations, { from: Date.now(), to: null }]
          : x.vacations.map((v) => (v.to === null ? { ...v, to: Date.now() } : v)),
      })),
    ),

    el('h3', {}, 'Display'),
    toggleRow('Reduce motion', 'Fewer animations.', s.reduceMotion, (on) => saveSettings((x) => ({ ...x, reduceMotion: on }))),
    toggleRow('Light mode', 'For slower computers: lower resolution, no animations.', !!s.lightMode, (on) => saveSettings((x) => ({ ...x, lightMode: on }))),

    el('h3', {}, 'Your data'),
    el('div', { className: 'setting-row' }, icon(ShieldCheck, 20), el('span', { className: 'grow' }, 'Stored only in this browser', el('small', {}, 'Nothing is ever sent anywhere.'))),
    el('div', { className: 'data-actions' }, exportBtn, importBtn, file),
    el(
      'p',
      { className: 'note' },
      `Last backup: ${s.lastExportAt ? relativeTime(Date.now() - s.lastExportAt) : 'never'}. If you uninstall the extension or clear browser data, ${s.plantName} is gone unless you have a backup.`,
    ),
    diagnosticsRow,
    el('div', { className: 'setting-row' }, el('span', { className: 'grow' }, 'Start over', el('small', {}, 'Erase this plant and plant a new seed.')), startOver),
  );
  void paintDiagnostics(diagnosticsRow);
}

/** Shows how many problems were recorded locally, with a way to clear them. */
async function paintDiagnostics(row: HTMLElement) {
  const errors = await errorsItem.getValue().catch(() => []);
  const clear = el('button', { type: 'button', className: 'btn ghost', disabled: errors.length === 0 }, 'Clear');
  clear.addEventListener('click', async () => {
    await errorsItem.setValue([]);
    void paintDiagnostics(row);
  });
  row.replaceChildren(
    el(
      'span',
      { className: 'grow' },
      'Diagnostics',
      el('small', {}, errors.length ? `${errors.length} problem${errors.length > 1 ? 's' : ''} recorded on this browser. Included in backups, so you can share them if something breaks.` : 'No problems recorded.'),
    ),
    clear,
  );
}
