import * as THREE from 'three';
import { createElement, Settings, ShieldCheck, Sprout, X, type IconNode } from 'lucide';
import { buildAjisai } from '../plant/ajisai';
import { skyAt } from '../scene/sky';
import { createWindowScene } from '../scene/window-scene';
import { CATALOG, DEFAULT_HABITS, habitById, MAX_HABITS, MOCK } from './mock';
import './newtab.css';

// ⚠ Mockup: every value below is static or nudged by hand. No engine is wired.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const icon = (node: IconNode, size = 18) =>
  createElement(node, { width: size, height: size, 'stroke-width': 1.75, 'aria-hidden': 'true' });
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: (Node | string)[]) => {
  const node: HTMLElementTagNameMap[K] = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

const params = new URLSearchParams(location.search);
const mock = {
  name: params.get('name') ?? MOCK.plantName,
  day: Number(params.get('day') ?? MOCK.day),
  health: Number(params.get('health') ?? MOCK.health),
  hourOverride: params.has('hour') ? Number(params.get('hour')) : null as number | null,
  needs: MOCK.needs.map((n) => ({ ...n })),
  queue: [...MOCK.queue],
};

// --- 3D window scene ---------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: params.has('capture') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
$('scene').appendChild(renderer.domElement);
const view = createWindowScene();

let needsRender = true;
const requestRender = () => (needsRender = true);

function setPlant() {
  view.setPlant(buildAjisai({ days: mock.day, health: mock.health }));
  requestRender();
}

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  view.resize(innerWidth, innerHeight);
  requestRender();
}
addEventListener('resize', resize);

// Render only when something changed: an idle new tab costs no GPU time.
function loop() {
  requestAnimationFrame(loop);
  if (!needsRender) return;
  renderer.render(view.scene, view.camera);
  needsRender = false;
}

// --- Clock & sky -------------------------------------------------------------------------
const currentHour = () => {
  if (mock.hourOverride !== null) return mock.hourOverride;
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
};

function greetingFor(h: number) {
  if (h < 5) return `Still up? ${mock.name} is resting.`;
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Time to wind down';
}

function tick() {
  const h = currentHour();
  const now = new Date();
  if (mock.hourOverride !== null) now.setHours(Math.floor(h), Math.round((h % 1) * 60));
  $('time').textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  $('time').setAttribute('datetime', now.toISOString());
  $('date').textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  $('greeting').textContent = greetingFor(h);

  view.setHour(h);
  document.documentElement.dataset.sky = skyAt(h).lamp > 0.55 ? 'night' : 'day';
  requestRender();
}

// --- Needs list --------------------------------------------------------------------------
function renderNeeds() {
  const pot = [40, 150, 290].filter((d) => mock.day >= d).length + 1; // matches the lab's repotting days
  const ordinal = ['1st', '2nd', '3rd', '4th'][pot - 1];
  $('plantName').textContent = mock.name;
  $('plantMeta').textContent = `Day ${mock.day} · ${ordinal} pot`;
  // Collapsed view: one tinted icon per habit, so the state still reads at a glance.
  $('needsMini').replaceChildren(
    ...mock.needs.map((n) => {
      const dot = el('span', { className: `mini${n.level < 0.45 ? ' low' : ''}`, title: habitById(n.habitId).name }, icon(habitById(n.habitId).icon, 14));
      return dot;
    }),
  );
  $('needsList').replaceChildren(
    ...mock.needs.map((n) => {
      const habit = habitById(n.habitId);
      const meter = el('span', { className: `meter${n.level < 0.45 ? ' low' : ''}` }, el('i'));
      (meter.firstElementChild as HTMLElement).style.width = `${Math.round(n.level * 100)}%`;
      meter.setAttribute('role', 'meter');
      meter.setAttribute('aria-valuenow', String(Math.round(n.level * 100)));
      meter.setAttribute('aria-label', `${habit.name} level`);
      const btn = el(
        'button',
        { type: 'button', className: 'need', title: `Answer “${habit.name}” now` },
        icon(habit.icon, 20),
        el('span', { className: 'name' }, habit.name),
        meter,
        el('span', { className: 'status' }, n.status),
      );
      btn.addEventListener('click', () => showQuestion(n.habitId));
      return el('li', {}, btn);
    }),
  );
}

// --- Question card -----------------------------------------------------------------------
const hints: Record<string, string> = {
  water: 'Its leaves are starting to droop.',
  stretch: 'A quick stretch keeps its stems standing tall.',
  eyes: 'Look out the window with it for a moment.',
};

function swapCard(render: () => void) {
  const card = $('ask');
  card.classList.add('leaving');
  setTimeout(() => {
    render();
    card.classList.remove('leaving');
  }, 220);
}

let dismissTimer = 0;

function showQuestion(habitId: string) {
  const habit = habitById(habitId);
  const card = $('ask');
  clearTimeout(dismissTimer);
  card.classList.remove('done', 'gone');
  const answer = (kind: 'yes' | 'no' | 'later') => onAnswer(habitId, kind);
  const yes = el('button', { type: 'button', className: 'btn primary' }, 'Yes');
  const no = el('button', { type: 'button', className: 'btn' }, 'Not yet');
  const later = el('button', { type: 'button', className: 'btn ghost' }, 'Later');
  yes.addEventListener('click', () => answer('yes'));
  no.addEventListener('click', () => answer('no'));
  later.addEventListener('click', () => answer('later'));
  card.replaceChildren(
    el(
      'div',
      { className: 'ask-head' },
      el('span', { className: 'ask-icon' }, icon(habit.icon, 18)),
      el('p', { className: 'ask-eyebrow' }, `${habit.name} · ${habit.every.toLowerCase()}`),
    ),
    el('h3', {}, habit.question),
    el('p', { className: 'hint' }, hints[habitId] ?? habit.plantPart),
    el('div', { className: 'ask-actions' }, yes, no, later),
  );
}

function showDone() {
  const card = $('ask');
  card.classList.add('done');
  card.replaceChildren(
    el('div', { className: 'ask-head' }, el('span', { className: 'ask-icon' }, icon(Sprout, 18)), el('p', { className: 'ask-eyebrow' }, 'All caught up')),
    el('h3', {}, `${mock.name} is happy for now.`),
    el('p', { className: 'hint' }, 'Next check-in in about 40 minutes.'),
  );
  dismissTimer = window.setTimeout(() => card.classList.add('gone'), 3000);
}

const responses = {
  yes: (habit: string) => `Nice. ${mock.name} felt that ${habit.toLowerCase()}.`,
  no: () => 'No worries. Try to fit it in soon.',
  later: () => 'Okay, I’ll ask again in 30 minutes.',
};

function onAnswer(habitId: string, kind: 'yes' | 'no' | 'later') {
  const need = mock.needs.find((n) => n.habitId === habitId);
  if (need && kind === 'yes') {
    need.level = 1;
    need.status = 'Just now';
    mock.health = Math.min(1, mock.health + 0.12);
  } else if (need && kind === 'no') {
    need.level = Math.max(0, need.level - 0.08);
    need.status = 'Skipped just now';
    mock.health = Math.max(0, mock.health - 0.05);
  }
  if (kind !== 'later') setPlant();
  renderNeeds();
  toast(responses[kind](habitById(habitId).name));

  mock.queue = mock.queue.filter((id) => id !== habitId);
  swapCard(() => (mock.queue.length ? showQuestion(mock.queue[0]) : showDone()));
}

let toastTimer = 0;
function toast(message: string) {
  const t = $('toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('show'), 2600);
}

// --- Settings drawer ---------------------------------------------------------------------
const INTERVALS = ['Every 30 min', 'Every 1 h', 'Every 2 h', 'Every 3 h', 'Once a day'];
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dayToggles(selected: string[]) {
  return el(
    'div',
    { className: 'days', role: 'group' },
    ...WEEK.map((d) => {
      const b = el('button', { type: 'button' }, d);
      b.setAttribute('aria-pressed', String(selected.includes(d)));
      b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')));
      return b;
    }),
  );
}

function hoursRow() {
  return el(
    'div',
    { className: 'hours' },
    el('input', { type: 'time', value: MOCK.workHours.start, ariaLabel: 'Start' }),
    '→',
    el('input', { type: 'time', value: MOCK.workHours.end, ariaLabel: 'End' }),
  );
}

function toggle(label: string, sub: string, checked = false) {
  const input = el('input', { type: 'checkbox', checked });
  return el('label', { className: 'setting-row' }, el('span', { className: 'grow' }, label, el('small', {}, sub)), input);
}

function renameRow() {
  const input = el('input', { type: 'text', className: 'rename-input', value: mock.name, maxLength: 24, ariaLabel: 'Plant name' });
  const save = el('button', { type: 'button', className: 'btn' }, 'Rename');
  save.addEventListener('click', () => {
    const name = input.value.trim();
    if (!name || name === mock.name) return;
    mock.name = name;
    renderNeeds();
    tick();
    toast(`Your plant is now called ${name}.`);
  });
  return el('div', { className: 'setting-row' }, input, save);
}

/** "Start over" always offers a backup first: it is the only destructive action in the app. */
function startOverRow() {
  const btn = el('button', { type: 'button', className: 'btn danger' }, 'Start over…');
  btn.addEventListener('click', () => {
    const ok = confirm(
      `Start over with a new seed?\n\n${mock.name}'s history will be erased from this browser. Export a backup first if you want to keep it.\n\n(Mock: nothing will be deleted.)`,
    );
    if (ok) toast('Start over (mock): would ask to export, then plant a new seed.');
  });
  return el('div', { className: 'setting-row' }, el('span', { className: 'grow' }, 'Start over', el('small', {}, 'Erase this plant and plant a new seed.')), btn);
}

function renderSettings() {
  const active = mock.needs.map((n) => habitById(n.habitId));
  const inactive = CATALOG.filter((h) => !active.includes(h));
  const habitRows = active.map((h) => {
    const select = el('select', { ariaLabel: `${h.name} interval` }, ...INTERVALS.map((i) => el('option', { selected: i === h.every }, i)));
    const remove = el('button', { type: 'button', className: 'btn ghost' }, 'Remove');
    return el(
      'div',
      { className: 'setting-row' },
      icon(h.icon, 20),
      el('span', { className: 'grow' }, h.name, el('small', {}, h.plantPart)),
      select,
      remove,
    );
  });
  const exportBtn = el('button', { type: 'button', className: 'btn primary' }, 'Export backup');
  const importBtn = el('button', { type: 'button', className: 'btn' }, 'Restore from file');
  exportBtn.addEventListener('click', () => toast('Export (mock): would download ajisai-backup.json'));
  importBtn.addEventListener('click', () => toast('Restore (mock): would open a file picker'));

  $('settingsBody').replaceChildren(
    el('h3', {}, `Habits · ${active.length} of ${MAX_HABITS}`),
    ...habitRows,
    el('p', { className: 'note' }, `Add one (${MAX_HABITS - active.length} left):`),
    el('div', { className: 'days' }, ...inactive.map((h) => el('button', { type: 'button', className: 'chip' }, `+ ${h.name}`))),

    el('h3', {}, 'Work hours'),
    hoursRow(),
    dayToggles(MOCK.workHours.days),
    el('p', { className: 'note' }, `Questions only appear during these hours. ${mock.name} never loses health outside them.`),

    el('h3', {}, 'Your plant'),
    renameRow(),

    el('h3', {}, 'Away'),
    toggle('Vacation mode', 'Pause your plant while you’re away.'),

    el('h3', {}, 'Display'),
    toggle('Reduce motion', 'Fewer animations; also follows your system setting.', matchMedia('(prefers-reduced-motion: reduce)').matches),

    el('h3', {}, 'Your data'),
    el(
      'div',
      { className: 'setting-row' },
      icon(ShieldCheck, 20),
      el('span', { className: 'grow' }, 'Stored only in this browser', el('small', {}, 'Nothing is ever sent anywhere.')),
    ),
    el('div', { className: 'data-actions' }, exportBtn, importBtn),
    startOverRow(),
    el(
      'p',
      { className: 'note' },
      `Last backup: ${MOCK.lastExport}. If you uninstall the extension or clear browser data, ${mock.name} is gone unless you have a backup.`,
    ),
  );
}

function openSettings(open: boolean) {
  if (open) renderSettings();
  $('settings').hidden = !open;
  $('settingsScrim').hidden = !open;
  if (open) ($('settings').querySelector('[data-close]') as HTMLElement).focus();
}

// --- Onboarding --------------------------------------------------------------------------
let obStep = 0;
const obSelected = new Set(DEFAULT_HABITS);
const OB_STEPS = 5;
const NAME_IDEAS = ['Aoi', 'Hana', 'Mizu', 'Sora', 'Kiko'];
let obName = '';

function renderOnboarding() {
  $('obSteps').replaceChildren(...Array.from({ length: OB_STEPS }, (_, i) => el('li', { className: i <= obStep ? 'on' : '' })));
  ($('obBack') as HTMLButtonElement).style.visibility = obStep === 0 ? 'hidden' : 'visible';
  $('obNext').textContent = obStep === OB_STEPS - 1 ? 'Plant the seed' : 'Continue';
  const body = $('obBody');
  $<HTMLButtonElement>('obNext').disabled = false;

  if (obStep === 0) {
    body.replaceChildren(
      el('div', { className: 'hero-sprout' }, icon(Sprout, 32)),
      el('h2', { id: 'obTitle' }, 'Grow an ajisai while you work'),
      el(
        'p',
        {},
        'Each time you open a new tab, your ajisai may ask one quick question about a healthy habit. Keep it up and it grows, gets new pots, and blooms. Skip too often and it droops, but it never dies.',
      ),
    );
  } else if (obStep === 1) {
    const input = el('input', {
      type: 'text',
      className: 'name-input',
      value: obName,
      maxLength: 24,
      placeholder: 'e.g. Aoi',
      ariaLabel: 'Plant name',
      autocomplete: 'off',
    });
    const next = $<HTMLButtonElement>('obNext');
    const sync = () => {
      obName = input.value.trim();
      next.disabled = !obName;
    };
    input.addEventListener('input', sync);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && obName) next.click();
    });
    const ideas = el(
      'div',
      { className: 'days' },
      ...NAME_IDEAS.map((n) => {
        const b = el('button', { type: 'button', className: 'chip' }, n);
        b.addEventListener('click', () => {
          input.value = n;
          sync();
          input.focus();
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
    );
    sync();
    requestAnimationFrame(() => input.focus());
  } else if (obStep === 2) {
    const counter = el('p', { className: 'counter' });
    const grid = el('div', { className: 'catalog' });
    const paint = () => {
      counter.textContent = `${obSelected.size} of ${MAX_HABITS} selected · start small, you can change this later`;
      grid.replaceChildren(
        ...CATALOG.map((h) => {
          const on = obSelected.has(h.id);
          const b = el('button', { type: 'button', className: 'habit-option', disabled: !on && obSelected.size >= MAX_HABITS }, icon(h.icon, 20), el('span', {}, h.name), el('small', {}, h.every));
          b.setAttribute('aria-pressed', String(on));
          b.addEventListener('click', () => {
            if (on) {
              if (obSelected.size > 1) obSelected.delete(h.id);
            } else obSelected.add(h.id);
            paint();
          });
          return b;
        }),
      );
    };
    paint();
    body.replaceChildren(el('h2', { id: 'obTitle' }, 'Pick your habits'), counter, grid);
  } else if (obStep === 3) {
    body.replaceChildren(
      el('h2', { id: 'obTitle' }, 'When do you work?'),
      el('p', {}, `Questions only show up during these hours. Outside them, ${obName || 'your ajisai'} rests and loses nothing.`),
      hoursRow(),
      dayToggles(MOCK.workHours.days),
    );
  } else {
    body.replaceChildren(
      el('div', { className: 'hero-sprout' }, icon(ShieldCheck, 32)),
      el('h2', { id: 'obTitle' }, 'Your data stays with you'),
      el(
        'p',
        {},
        'Everything is stored in this browser only. No account, no tracking, nothing sent anywhere. You can export a backup from Settings at any time.',
      ),
    );
  }
}

function openOnboarding(open: boolean) {
  obStep = 0;
  obName = '';
  $('onboarding').hidden = !open;
  if (open) renderOnboarding();
}

$('obNext').addEventListener('click', () => {
  if (obStep < OB_STEPS - 1) {
    obStep++;
    renderOnboarding();
  } else {
    mock.name = obName;
    openOnboarding(false);
    renderNeeds();
    tick();
    toast(`${mock.name} is planted. See you on your next tab.`);
  }
});
$('obBack').addEventListener('click', () => {
  obStep = Math.max(0, obStep - 1);
  renderOnboarding();
});

// --- Review-only controls ----------------------------------------------------------------
function renderMockControls() {
  const hourOut = el('output');
  const hour = el('input', { type: 'range', min: '0', max: '24', step: '0.25', value: String(currentHour()) });
  const fmt = () => (hourOut.textContent = mock.hourOverride === null ? ' (real time)' : ` ${Math.floor(mock.hourOverride)}:${String(Math.round((mock.hourOverride % 1) * 60)).padStart(2, '0')}`);
  hour.addEventListener('input', () => {
    mock.hourOverride = Number(hour.value);
    fmt();
    tick();
  });
  const realTime = el('button', { type: 'button' }, 'Real time');
  realTime.addEventListener('click', () => {
    mock.hourOverride = null;
    hour.value = String(currentHour());
    fmt();
    tick();
  });

  const day = el('select', {}, ...[0, 7, 42, 90, 180, 365].map((d) => el('option', { value: String(d), selected: d === mock.day }, `Day ${d}`)));
  day.addEventListener('change', () => {
    mock.day = Number(day.value);
    renderNeeds();
    setPlant();
  });
  const health = el('input', { type: 'range', min: '0', max: '1', step: '0.01', value: String(mock.health) });
  health.addEventListener('input', () => {
    mock.health = Number(health.value);
    setPlant();
  });

  const ob = el('button', { type: 'button' }, 'Onboarding');
  ob.addEventListener('click', () => openOnboarding(true));
  const st = el('button', { type: 'button' }, 'Settings');
  st.addEventListener('click', () => openSettings(true));
  const reset = el('button', { type: 'button' }, 'Reset questions');
  reset.addEventListener('click', () => {
    mock.queue = [...MOCK.queue];
    showQuestion(mock.queue[0]);
  });

  fmt();
  $('mockBody').replaceChildren(
    el('label', {}, 'Time of day', hourOut, hour),
    el('div', { className: 'row' }, realTime),
    el('label', {}, 'Plant age ', day),
    el('label', {}, 'Health', health),
    el('div', { className: 'row' }, ob, st, reset),
  );
}

// --- Boot --------------------------------------------------------------------------------
$('openSettings').append(icon(Settings, 20));
$('openSettings').addEventListener('click', () => openSettings(true));
$('settings').querySelector('[data-close]')!.append(icon(X, 20));
$('settings').querySelector('[data-close]')!.addEventListener('click', () => openSettings(false));
$('settingsScrim').addEventListener('click', () => openSettings(false));
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') openSettings(false);
});

resize();
setPlant();
tick();
setInterval(tick, 30_000);
renderNeeds();
showQuestion(mock.queue[0]);
renderMockControls();
const NEEDS_COLLAPSE_AFTER_MS = 6000;
setTimeout(() => $('needs').classList.add('collapsed'), NEEDS_COLLAPSE_AFTER_MS);
if (params.get('onboarding') === '1') openOnboarding(true);
if (params.get('settings') === '1') openSettings(true);
requestAnimationFrame(loop);
