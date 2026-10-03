import * as THREE from 'three';
import { Settings as SettingsIcon, Sprout } from 'lucide';
import { catalogHabit, DAILY } from '../../engine/catalog';
import { computeState, potNumber, type PlantState } from '../../engine/model';
import { availability, duePrompts, minutesUntilDue, wouldCount, type Availability } from '../../engine/scheduler';
import type { Answer, AnswerEvent, HabitSetting, Settings } from '../../engine/types';
import { buildAjisai } from '../../plant/ajisai';
import { skyAt } from '../../scene/sky';
import { createWindowScene } from '../../scene/window-scene';
import { appendEvent, clearAll, eventsItem, plant, settingsItem, watchAll } from '../../storage/items';
import { $, el, icon, ordinal, toast } from '../../ui/dom';
import { habitIcon } from '../../ui/icons';
import { openOnboarding } from '../../ui/onboarding';
import { initSettings, openSettings } from '../../ui/settings';
import './style.css';

const DEV = import.meta.env.DEV;
const params = new URLSearchParams(location.search);

/** Dev-only visual overrides (never affect stored data). */
const preview = {
  hour: DEV && params.has('hour') ? Number(params.get('hour')) : (null as number | null),
  days: DEV && params.has('day') ? Number(params.get('day')) : (null as number | null),
  health: DEV && params.has('health') ? Number(params.get('health')) : (null as number | null),
};

let settings: Settings | null = null;
let events: AnswerEvent[] = [];
let state: PlantState | null = null;
let loaded = false;

// --- 3D window scene ---------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: params.has('capture') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
$('scene').appendChild(renderer.domElement);
const view = createWindowScene();

let needsRender = true;
const requestRender = () => (needsRender = true);

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  view.resize(innerWidth, innerHeight);
  requestRender();
}
addEventListener('resize', resize);

function loop() {
  requestAnimationFrame(loop);
  if (!needsRender) return;
  renderer.render(view.scene, view.camera);
  needsRender = false;
}

let plantKey = '';
function updatePlant() {
  const days = preview.days ?? state?.plantDays ?? 0;
  const health = preview.health ?? state?.health ?? 1;
  const key = `${days.toFixed(1)}|${health.toFixed(2)}`;
  if (key === plantKey) return;
  plantKey = key;
  view.setPlant(buildAjisai({ days, health }), days);
  requestRender();
}

// --- Clock & sky -------------------------------------------------------------------------
function displayDate() {
  const now = new Date();
  if (preview.hour !== null) now.setHours(Math.floor(preview.hour), Math.round((preview.hour % 1) * 60));
  return now;
}

function greeting(h: number, avail: Availability | null) {
  const name = settings?.plantName;
  if (name && avail === 'vacation') return `Enjoy your time off. ${name} is waiting.`;
  if (name && avail === 'off-hours') return h < 5 || h >= 21 ? `Time to rest. ${name} is sleeping.` : `Off the clock. ${name} is resting.`;
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function tick() {
  const now = displayDate();
  const h = now.getHours() + now.getMinutes() / 60;
  $('time').textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  $('time').setAttribute('datetime', now.toISOString());
  $('date').textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  $('greeting').textContent = greeting(h, settings ? availability(settings, Date.now()) : null);
  view.setHour(h);
  document.documentElement.dataset.sky = skyAt(h).lamp > 0.55 ? 'night' : 'day';
  requestRender();
}

// --- Needs list --------------------------------------------------------------------------
function statusFor(habit: HabitSetting, now: number, avail: Availability) {
  const h = state!.byId[habit.id]!;
  if (avail === 'vacation') return 'On vacation';
  if (avail === 'off-hours') return 'Resting';
  const mins = minutesUntilDue(habit, h, now);
  if (mins === 0) return h.health < 0.45 ? 'Low · due now' : 'Due now';
  if (mins === Infinity) return 'Done for today';
  return mins < 60 ? `Next in ${mins} min` : `Next in ${Math.round(mins / 60)} h`;
}

function renderNeeds(now: number) {
  const s = settings!;
  const avail = availability(s, now);
  $('plantName').textContent = s.plantName;
  $('plantMeta').textContent = `Day ${state!.calendarDay} · ${ordinal(potNumber(state!.plantDays))} pot`;
  $('needsMini').replaceChildren(
    ...s.habits.map((habit) => {
      const low = state!.byId[habit.id]!.health < 0.45;
      return el('span', { className: `mini${low ? ' low' : ''}`, title: catalogHabit(habit.id)!.name }, icon(habitIcon(habit.id), 14));
    }),
  );
  $('needsList').replaceChildren(
    ...s.habits.map((habit) => {
      const meta = catalogHabit(habit.id)!;
      const level = state!.byId[habit.id]!.health;
      const meter = el('span', { className: `meter${level < 0.45 ? ' low' : ''}`, role: 'meter', ariaLabel: `${meta.name} level` }, el('i'));
      meter.setAttribute('aria-valuenow', String(Math.round(level * 100)));
      (meter.firstElementChild as HTMLElement).style.width = `${Math.round(level * 100)}%`;
      const btn = el(
        'button',
        { type: 'button', className: 'need', title: `Answer “${meta.name}” now` },
        icon(habitIcon(habit.id), 20),
        el('span', { className: 'name' }, meta.name),
        meter,
        el('span', { className: 'status' }, statusFor(habit, now, avail)),
      );
      btn.addEventListener('click', () => {
        forcedHabit = habit.id;
        render();
      });
      return el('li', {}, btn);
    }),
  );
}

// --- Question card -----------------------------------------------------------------------
let forcedHabit: string | null = null;
let cardHabit: string | null = null;
let showingDone = false;
let doneTimer = 0;

function setCard(children: Node[], habitId: string | null) {
  const card = $('ask');
  card.classList.remove('gone', 'done');
  if (habitId === cardHabit && card.childElementCount) return;
  cardHabit = habitId;
  card.classList.add('leaving');
  setTimeout(() => {
    card.replaceChildren(...children);
    card.classList.remove('leaving');
  }, card.childElementCount ? 200 : 0);
}

function hideCard() {
  cardHabit = null;
  $('ask').classList.add('gone');
}

function questionCard(habitId: string) {
  const meta = catalogHabit(habitId)!;
  const habit = settings!.habits.find((h) => h.id === habitId)!;
  const low = state!.byId[habitId]!.health < 0.5;
  const buttons = (['yes', 'no', 'later'] as Answer[]).map((kind) => {
    const b = el('button', { type: 'button', className: `btn${kind === 'yes' ? ' primary' : kind === 'later' ? ' ghost' : ''}` }, { yes: 'Yes', no: 'Not yet', later: 'Later' }[kind]);
    b.addEventListener('click', () => void answer(habitId, kind));
    return b;
  });
  const every = habit.intervalMin >= DAILY ? 'once a day' : `every ${habit.intervalMin < 60 ? `${habit.intervalMin} min` : `${habit.intervalMin / 60} h`}`;
  return [
    el('div', { className: 'ask-head' }, el('span', { className: 'ask-icon' }, icon(habitIcon(habitId), 18)), el('p', { className: 'ask-eyebrow' }, `${meta.name} · ${every}`)),
    el('h3', {}, meta.question),
    el('p', { className: 'hint' }, low ? meta.lowHint : meta.plantPart),
    el('div', { className: 'ask-actions' }, ...buttons),
  ];
}

function renderCard(now: number) {
  const queue = forcedHabit ? [forcedHabit] : duePrompts(settings!, state!, now);
  if (queue[0]) {
    showingDone = false;
    clearTimeout(doneTimer);
    setCard(questionCard(queue[0]), queue[0]);
  } else if (!showingDone) {
    hideCard();
  }
}

function showDone() {
  showingDone = true;
  setCard(
    [
      el('div', { className: 'ask-head' }, el('span', { className: 'ask-icon' }, icon(Sprout, 18)), el('p', { className: 'ask-eyebrow' }, 'All caught up')),
      el('h3', {}, `${settings!.plantName} is happy for now.`),
      el('p', { className: 'hint' }, 'See you on a later tab.'),
    ],
    '__done',
  );
  $('ask').classList.add('done');
  clearTimeout(doneTimer);
  doneTimer = window.setTimeout(() => {
    showingDone = false;
    hideCard();
  }, 3000);
}

async function answer(habitId: string, kind: Answer) {
  const s = settings!;
  const now = Date.now();
  const habit = s.habits.find((h) => h.id === habitId)!;
  const counts = kind !== 'later' && wouldCount(habit, state!.byId[habitId]!, now);
  const e: AnswerEvent = { id: crypto.randomUUID(), ts: now, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, habitId, answer: kind };
  forcedHabit = null;
  events = [...events, e];
  try {
    await appendEvent(e);
  } catch (err) {
    storageFailed(err);
    return;
  }

  const name = catalogHabit(habitId)!.name.toLowerCase();
  if (kind === 'later') toast('Okay, I’ll ask again in 30 minutes.');
  else if (!counts) toast('Noted. That one already counted recently.');
  else toast(kind === 'yes' ? `Nice. ${s.plantName} felt that ${name}.` : 'No worries. Try to fit it in soon.');

  const after = computeState(s, events, now);
  if (duePrompts(s, after, now).length === 0) showDone();
  render();
}

// --- Data flow ---------------------------------------------------------------------------
function storageFailed(err: unknown) {
  const msg = String(err);
  toast(msg.includes('context invalidated') ? 'Marumado was updated. Reload this tab.' : 'Couldn’t save. Reload this tab and try again.');
}

async function reload() {
  try {
    [settings, events] = await Promise.all([settingsItem.getValue(), eventsItem.getValue()]);
  } catch (err) {
    storageFailed(err);
  }
  loaded = true;
  render();
}

function render() {
  if (!loaded) return;
  const now = Date.now();
  document.documentElement.classList.toggle('reduce-motion', !!settings?.reduceMotion);

  if (!settings) {
    state = null;
    hideCard();
    $('needs').hidden = true;
    $('openSettings').hidden = true;
    updatePlant();
    tick();
    if ($('onboarding').hidden) {
      openOnboarding(async (s) => {
        await plant(s);
        toast(`${s.plantName} is planted. See you on your next tab.`);
      });
    }
    return;
  }

  $('onboarding').hidden = true;
  $('needs').hidden = false;
  $('openSettings').hidden = false;
  state = computeState(settings, events, now);
  updatePlant();
  renderNeeds(now);
  renderCard(now);
  tick();
}

// --- Dev-only review controls ------------------------------------------------------------
function mountDevControls() {
  const panel = $('mockControls');
  if (!DEV) {
    panel.remove();
    return;
  }
  panel.hidden = false;
  const hour = el('input', { type: 'range', min: '0', max: '24', step: '0.25', value: String(displayDate().getHours()) });
  hour.addEventListener('input', () => {
    preview.hour = Number(hour.value);
    tick();
  });
  const days = el(
    'select',
    {},
    el('option', { value: '' }, 'Real'),
    ...[0, 7, 42, 90, 180, 365].map((d) => el('option', { value: String(d), selected: d === preview.days }, `Day ${d}`)),
  );
  days.addEventListener('change', () => {
    preview.days = days.value === '' ? null : Number(days.value);
    updatePlant();
  });
  const health = el('input', { type: 'range', min: '0', max: '1', step: '0.01', value: String(preview.health ?? 1) });
  health.addEventListener('input', () => {
    preview.health = Number(health.value);
    updatePlant();
  });
  const real = el('button', { type: 'button' }, 'Real time & plant');
  real.addEventListener('click', () => {
    preview.hour = preview.days = preview.health = null;
    days.value = '';
    updatePlant();
    tick();
  });
  const reset = el('button', { type: 'button' }, 'Erase all data');
  reset.addEventListener('click', () => {
    if (confirm('Dev: erase settings and history?')) void clearAll();
  });
  $('mockBody').replaceChildren(
    el('label', {}, 'Sky hour', hour),
    el('label', {}, 'Plant age ', days),
    el('label', {}, 'Health', health),
    el('div', { className: 'row' }, real, reset),
  );
}

// --- Boot --------------------------------------------------------------------------------
$('openSettings').append(icon(SettingsIcon, 20));
$('openSettings').addEventListener('click', () => openSettings(true));
initSettings({ getSettings: () => settings, getEvents: () => events });
mountDevControls();

resize();
tick();
requestAnimationFrame(loop);

watchAll(() => void reload());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void reload();
});
setInterval(render, 30_000);
setTimeout(() => $('needs').classList.add('collapsed'), 6000);
void reload();
