import { ShieldCheck, X } from 'lucide';
import { makeBackup, parseBackup } from '../engine/backup';
import { CATALOG, catalogHabit, INTERVAL_OPTIONS, intervalLabel, MAX_HABITS, MIN_HABITS } from '../engine/catalog';
import type { AnswerEvent, Settings } from '../engine/types';
import { clearAll, replaceAll, saveSettings } from '../storage/items';
import { $, el, icon, relativeTime, setBackgroundInert, toast } from './dom';
import { habitIcon } from './icons';
import { daysPicker, hoursPicker } from './pickers';

interface Ctx {
  getSettings: () => Settings | null;
  getEvents: () => AnswerEvent[];
}

let ctx: Ctx;

export function initSettings(c: Ctx) {
  ctx = c;
  const close = $('settings').querySelector<HTMLButtonElement>('[data-close]')!;
  close.append(icon(X, 20));
  close.addEventListener('click', () => openSettings(false));
  $('settingsScrim').addEventListener('click', () => openSettings(false));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') openSettings(false);
  });
}

export function openSettings(open: boolean) {
  if (open) render();
  $('settings').hidden = !open;
  $('settingsScrim').hidden = !open;
  setBackgroundInert(open || !$('onboarding').hidden); // onboarding may have opened underneath (start over)
  if (open) $('settings').querySelector<HTMLElement>('[data-close]')!.focus();
}

export const settingsOpen = () => !$('settings').hidden;

function toggleRow(label: string, sub: string, checked: boolean, onChange: (on: boolean) => void) {
  const input = el('input', { type: 'checkbox', checked });
  input.addEventListener('change', () => onChange(input.checked));
  return el('label', { className: 'setting-row' }, el('span', { className: 'grow' }, label, el('small', {}, sub)), input);
}

export function downloadBackup(settings: Settings, events: AnswerEvent[]) {
  const now = Date.now();
  const blob = new Blob([JSON.stringify(makeBackup(settings, events, now), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const date = new Date(now).toISOString().slice(0, 10);
  const a = el('a', { href: url, download: `marumado-${settings.plantName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${date}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  void saveSettings((s) => ({ ...s, lastExportAt: now }));
}

/** Handlers run later than render(): always read the latest settings, never the render-time copy. */
const current = () => ctx.getSettings()!;

function render() {
  const s = ctx.getSettings();
  if (!s) return;
  const active = s.habits;

  // --- Your plant
  const nameInput = el('input', { type: 'text', className: 'rename-input', value: s.plantName, maxLength: 24, ariaLabel: 'Plant name' });
  const renameBtn = el('button', { type: 'button', className: 'btn' }, 'Rename');
  renameBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name || name === current().plantName) return;
    await saveSettings((x) => ({ ...x, plantName: name }));
    toast(`Your plant is now called ${name}.`);
  });

  // --- Habits
  const habitRows = active.map((h) => {
    const meta = catalogHabit(h.id)!;
    const select = el(
      'select',
      { ariaLabel: `${meta.name} interval` },
      ...INTERVAL_OPTIONS.map((m) => el('option', { value: String(m), selected: m === h.intervalMin }, intervalLabel(m))),
    );
    select.addEventListener('change', () =>
      saveSettings((x) => ({ ...x, habits: x.habits.map((y) => (y.id === h.id ? { ...y, intervalMin: Number(select.value) } : y)) })),
    );
    const remove = el('button', { type: 'button', className: 'btn ghost', disabled: active.length <= MIN_HABITS }, 'Remove');
    remove.addEventListener('click', async () => {
      await saveSettings((x) => ({ ...x, habits: x.habits.filter((y) => y.id !== h.id) }));
      render();
    });
    return el('div', { className: 'setting-row' }, icon(habitIcon(h.id), 20), el('span', { className: 'grow' }, meta.name, el('small', {}, meta.plantPart)), select, remove);
  });
  const addable = CATALOG.filter((c) => !active.some((h) => h.id === c.id));
  const addChips = addable.map((c) => {
    const b = el('button', { type: 'button', className: 'chip', disabled: active.length >= MAX_HABITS }, `+ ${c.name}`);
    b.addEventListener('click', async () => {
      await saveSettings((x) => ({ ...x, habits: [...x.habits, { id: c.id, intervalMin: c.defaultIntervalMin }] }));
      render();
    });
    return b;
  });

  // --- Work hours
  const hoursError = el('p', { className: 'note' });
  const hours = hoursPicker(s.workHours, (start, end) => {
    if (start === end) {
      hoursError.textContent = 'Start and end can’t be the same.';
      return;
    }
    hoursError.textContent = '';
    void saveSettings((x) => ({ ...x, workHours: { ...x.workHours, start, end } }));
  });
  const days = daysPicker(s.workHours.days, (d) => {
    if (d.length === 0) {
      hoursError.textContent = 'Keep at least one workday.';
      return;
    }
    hoursError.textContent = '';
    void saveSettings((x) => ({ ...x, workHours: { ...x.workHours, days: d } }));
  });

  // --- Data
  const onVacation = s.vacations.some((v) => v.to === null);
  const exportBtn = el('button', { type: 'button', className: 'btn primary' }, 'Export backup');
  exportBtn.addEventListener('click', () => {
    downloadBackup(current(), ctx.getEvents());
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
    if (!confirm(`Replace ${current().plantName} with ${b.settings.plantName} from this backup (${b.events.length} answers)?`)) return;
    await replaceAll(b.settings, b.events);
    toast(`${b.settings.plantName} is back.`);
    render();
  });
  const importBtn = el('button', { type: 'button', className: 'btn' }, 'Restore from file');
  importBtn.addEventListener('click', () => file.click());
  const startOver = el('button', { type: 'button', className: 'btn danger' }, 'Start over…');
  startOver.addEventListener('click', async () => {
    const cur = current();
    if (!confirm(`Start over with a new seed?\n\n${cur.plantName}'s history will be erased from this browser.`)) return;
    if (confirm('Download a backup of the current plant first?')) downloadBackup(cur, ctx.getEvents());
    await clearAll();
    openSettings(false);
  });

  $('settingsBody').replaceChildren(
    el('h3', {}, 'Your plant'),
    el('div', { className: 'setting-row' }, nameInput, renameBtn),

    el('h3', {}, `Habits · ${active.length} of ${MAX_HABITS}`),
    ...habitRows,
    ...(addable.length ? [el('p', { className: 'note' }, active.length >= MAX_HABITS ? 'Remove one to add another.' : `Add one (${MAX_HABITS - active.length} left):`), el('div', { className: 'days' }, ...addChips)] : []),

    el('h3', {}, 'Work hours'),
    hours,
    days,
    hoursError,
    el('p', { className: 'note' }, `Questions only appear during these hours. ${s.plantName} never loses health outside them.`),

    el('h3', {}, 'Away'),
    toggleRow('Vacation mode', 'Pause questions and health while you’re away.', onVacation, (on) =>
      saveSettings((x) => ({
        ...x,
        vacations: on ? [...x.vacations, { from: Date.now(), to: null }] : x.vacations.map((v) => (v.to === null ? { ...v, to: Date.now() } : v)),
      })),
    ),

    el('h3', {}, 'Display'),
    toggleRow('Reduce motion', 'Fewer animations.', s.reduceMotion, (on) => saveSettings((x) => ({ ...x, reduceMotion: on }))),

    el('h3', {}, 'Your data'),
    el('div', { className: 'setting-row' }, icon(ShieldCheck, 20), el('span', { className: 'grow' }, 'Stored only in this browser', el('small', {}, 'Nothing is ever sent anywhere.'))),
    el('div', { className: 'data-actions' }, exportBtn, importBtn, file),
    el(
      'p',
      { className: 'note' },
      `Last backup: ${s.lastExportAt ? relativeTime(Date.now() - s.lastExportAt) : 'never'}. If you uninstall the extension or clear browser data, ${s.plantName} is gone unless you have a backup.`,
    ),
    el('div', { className: 'setting-row' }, el('span', { className: 'grow' }, 'Start over', el('small', {}, 'Erase this plant and plant a new seed.')), startOver),
  );
}
