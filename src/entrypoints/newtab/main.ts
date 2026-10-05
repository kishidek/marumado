import { Settings as SettingsIcon, Sprout } from 'lucide';
import { catalogHabit, DAILY, questionFor } from '../../engine/catalog';
import {
  almostReady,
  GARDEN,
  gardenHealth,
  gardenLook,
  initialGarden,
  isGardenTime,
  lookDays,
  pottedPlantDays,
  visibleGarden,
} from '../../engine/garden';
import { computeState, potNumber, type Checkpoint, type PlantState } from '../../engine/model';
import { availability, duePrompts, minutesUntilDue, wouldCount, type Availability } from '../../engine/scheduler';
import type { Answer, AnswerEvent, GardenState, HabitSetting, PlantStyle, Settings } from '../../engine/types';
import { buildAjisai, type AjisaiBuild } from '../../plant/ajisai';
import { skyAt } from '../../scene/sky';
import * as THREE from 'three';
import { createGlHost } from '../../scene/gl-host';
import { createWindowScene } from '../../scene/window-scene';
import { shiftBack, simulateDays, type Pattern } from '../../engine/simulate';
import { installErrorLog, logError } from '../../storage/error-log';
import {
  appendEvent,
  backupReminderItem,
  checkpointItem,
  clearAll,
  compactIfNeeded,
  eventsItem,
  gardenItem,
  moveToGardenIfDue,
  nameNewSeed,
  plant,
  replaceAll,
  settingsItem,
  vacationReminderItem,
  watchAll,
} from '../../storage/items';
import { $, el, icon, ordinal, setBackgroundInert, toast } from '../../ui/dom';
import { initHelp } from '../../ui/help';
import { closeNewSeedDialog, newSeedOpen, openNewSeedDialog } from '../../ui/new-seed';
import { habitIcon } from '../../ui/icons';
import { openOnboarding } from '../../ui/onboarding';
import { initSettings, openSettings, refreshSettings, settingsOpen } from '../../ui/settings';
import './style.css';

const DEV = import.meta.env.DEV;
const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const params = new URLSearchParams(location.search);

/** Dev-only visual overrides (never affect stored data). */
const preview = {
  hour: DEV && params.has('hour') ? Number(params.get('hour')) : (null as number | null),
  days: DEV && params.has('day') ? Number(params.get('day')) : (null as number | null),
  health: DEV && params.has('health') ? Number(params.get('health')) : (null as number | null),
};

let settings: Settings | null = null;
let events: AnswerEvent[] = [];
let checkpoint: Checkpoint | null = null;
let gardenStored: GardenState | null = null;
/** The garden as stored, or the first generation if nothing has moved yet. */
const garden = () => gardenStored ?? initialGarden(settings!);
/**
 * How the current plant is called in the UI. While the new seed waits for its name, the stored
 * name still belongs to the plant that moved, so it must not be used (bug log #27).
 */
const plantLabel = () => (settings && gardenStored?.pendingSeed ? 'your new seed' : (settings?.plantName ?? 'your ajisai'));
/** Seed of a generation's plant shape (generation 0 keeps the original seed 7). */
const seedFor = (generation: number) => 7 + generation * 13;
let state: PlantState | null = null;
let loaded = false;

// --- 3D window scene ---------------------------------------------------------------------
let needsRender = true;
const requestRender = () => (needsRender = true);

const view = createWindowScene();
const gl = createGlHost($('scene'), {
  capture: params.has('capture'),
  onChange: (state) => {
    // No WebGL (GPU off, policy, privacy extensions) or context taken away: CSS window, UI still works.
    $('fallback').hidden = state !== 'unsupported' && state !== 'lost';
    $('fallbackNote').hidden = state !== 'unsupported';
    requestRender();
  },
});

function resize() {
  gl.resize(innerWidth, innerHeight);
  view.resize(innerWidth, innerHeight);
  requestRender();
}
addEventListener('resize', resize);

let lastFrame = performance.now();
/** Dev-only: when a render script drives frames itself (scripts/render-deck.mjs). */
let manualClock = DEV && params.get('manual') === '1'; // visual tests step frames themselves
function loop(now: number) {
  requestAnimationFrame(loop);
  if (manualClock) return;
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  // Animations (health easing, answer feedback) keep frames coming only while they run.
  if (stepHealth(dt)) needsRender = true;
  if (view.update(dt)) needsRender = true;
  if (!needsRender) return;
  gl.render(view.scene, view.camera);
  if (gl.state === 'ready' && !performance.getEntriesByName('marumado:first-frame').length) {
    performance.mark('marumado:first-frame'); // cold-open budget: < 300 ms on a real GPU
    if (DEV) console.info(`[marumado] first 3D frame at ${Math.round(performance.now())} ms`);
  }
  needsRender = false;
}

const reduceMotion = () => !!settings?.reduceMotion || !!settings?.lightMode || matchMedia('(prefers-reduced-motion: reduce)').matches;
const targetHealth = () => preview.health ?? state?.health ?? 1;

/** Health on screen eases toward the real value, so an answer visibly perks the plant up (or down). */
let shownHealth: number | null = null;
const HEALTH_EASE_S = 0.35;

function updatePlant() {
  if (shownHealth === null || preview.health !== null || reduceMotion()) shownHealth = targetHealth();
  buildPlant();
}

function stepHealth(dt: number): boolean {
  const target = targetHealth();
  if (shownHealth === null || shownHealth === target) return false;
  const next = target + (shownHealth - target) * Math.exp(-dt / HEALTH_EASE_S);
  shownHealth = Math.abs(next - target) < 0.004 ? target : next;
  buildPlant();
  return true;
}

let plantKey = '';
/** Look days of the potted plant: growth since this generation started, compressed (plans/002-garden.md). */
const pottedLook = () => preview.days ?? (settings && state ? lookDays(pottedPlantDays(garden(), state)) : 0);

function buildPlant() {
  const days = pottedLook();
  const health = shownHealth ?? targetHealth();
  const g = settings ? garden() : null;
  const style = g?.current.style;
  const seed = seedFor(g?.moved.length ?? 0);
  const key = `${days.toFixed(1)}|${health.toFixed(2)}|${JSON.stringify(style)}|${seed}`;
  if (key === plantKey) return;
  plantKey = key;
  view.setPlant(buildAjisai({ days, health, style, seed }), days);
  requestRender();
}

// --- Garden --------------------------------------------------------------------------------
/** Garden builds by plant id; rebuilt only when their look or displayed health moves a step. */
const gardenBuilds = new Map<string, { key: string; build: AjisaiBuild }>();
/** While the move ceremony runs, the plant that's flying isn't shown in the garden yet. */
let ceremonyFor: string | null = null;
/**
 * Set *before* the move is saved: saving triggers a storage-watch re-render, which must not open
 * the new-seed dialog over the flight (bug log #25).
 */
let moving = false;
/** Check for a move once per tab open / tab shown, never right after an answer. */
let gardenCheck = true;

function renderGarden() {
  if (!settings || !state) {
    for (const entry of gardenBuilds.values()) entry.build.dispose();
    gardenBuilds.clear();
    view.setGarden([]);
    return;
  }
  const health = Math.round(gardenHealth(targetHealth()) * 5) / 5;
  const g = garden();
  // During a move the newest garden plant is still in the air (or about to take off).
  const flying = ceremonyFor ?? (moving ? g.moved.at(-1)?.id : null);
  let list = visibleGarden(g).filter((x) => x.plant.id !== flying);
  if (settings.lightMode) list = list.slice(-3);
  const keep = new Set<string>();
  const placed = list.map(({ plant, generation, slot }) => {
    const look = gardenLook(plant, state!);
    const key = `${Math.round(look / 5)}|${health}`;
    keep.add(plant.id);
    let entry = gardenBuilds.get(plant.id);
    if (!entry || entry.key !== key) {
      entry?.build.dispose();
      entry = { key, build: buildAjisai({ days: look, health, style: plant.style, seed: seedFor(generation), potted: false, detail: 'low' }) };
      gardenBuilds.set(plant.id, entry);
    }
    return { build: entry.build, slot };
  });
  for (const [id, entry] of gardenBuilds) {
    if (!keep.has(id)) {
      entry.build.dispose();
      gardenBuilds.delete(id);
    }
  }
  view.setGarden(placed);
  requestRender();
}

/** Runs the move if it's due: ceremony (flight through the window), then the new-seed dialog. */
async function maybeMoveToGarden() {
  if (!settings || !state) return;
  const before = garden();
  if (!isGardenTime(before, state) || document.visibilityState !== 'visible') return;
  const flyerStyle: PlantStyle = before.current.style;
  const generation = before.moved.length;
  const flyHealth = shownHealth ?? targetHealth();
  moving = true;
  if (!reduceMotion()) view.holdFraming(true); // the wide view stays while the plant flies
  const moved = await moveToGardenIfDue().catch((err: unknown) => {
    storageFailed(err);
    return null;
  });
  const plantMoved = moved ? (await gardenItem.getValue())?.moved.at(-1) : null;
  if (!plantMoved || reduceMotion()) {
    // Not due on the stored data (another tab did it), or no animation wanted.
    moving = false;
    view.holdFraming(false);
    render();
    return;
  }
  ceremonyFor = plantMoved.id;
  renderGarden();
  const flyer = buildAjisai({ days: GARDEN.fullLook, health: flyHealth, style: flyerStyle, seed: seedFor(generation), potted: false, detail: 'low' });
  for (const c of flyer.group.children) if (c instanceof THREE.Mesh) c.visible = false; // no mound or shadow in the air
  view.flyToGarden(flyer, generation % GARDEN.slots, () => {
    ceremonyFor = null;
    moving = false;
    render();
    view.cheer('sparkle');
  });
  requestRender();
}

// --- Clock & sky -------------------------------------------------------------------------
function displayDate() {
  const now = new Date();
  if (preview.hour !== null) now.setHours(Math.floor(preview.hour), Math.round((preview.hour % 1) * 60));
  return now;
}

function greeting(h: number, avail: Availability | null) {
  const name = settings ? plantLabel() : undefined;
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
  const sky = skyAt(h);
  const fb = $('fallback').style;
  fb.setProperty('--sky-top', `#${sky.top.getHexString()}`);
  fb.setProperty('--sky-bottom', `#${sky.bottom.getHexString()}`);
  fb.setProperty('--ridge', `#${sky.ink.clone().lerp(sky.haze, 0.45).getHexString()}`);
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
  const g = garden();
  $('plantName').textContent = g.pendingSeed ? 'New seed' : s.plantName;
  const day = Math.round((new Date(now).setHours(12, 0, 0, 0) - new Date(g.current.plantedAt).setHours(12, 0, 0, 0)) / 86_400_000) + 1;
  const meta = [`Day ${Math.max(1, day)}`, `${ordinal(potNumber(pottedLook()))} pot`];
  if (almostReady(g, state!)) meta.push('Almost ready for the garden');
  if (g.moved.length) meta.push(`${g.moved.length} in the garden`);
  $('plantMeta').textContent = meta.join(' · ');
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
/** What the card currently shows; it re-renders only when this changes (no flicker on every tick). */
let cardKey: string | null = null;
let showingDone = false;
let doneTimer = 0;

function setCard(children: Node[], key: string | null) {
  const card = $('ask');
  card.classList.remove('gone', 'done');
  if (key === cardKey && card.childElementCount) return;
  cardKey = key;
  card.classList.add('leaving');
  setTimeout(() => {
    card.replaceChildren(...children);
    card.classList.remove('leaving');
  }, card.childElementCount ? 200 : 0);
}

function hideCard() {
  cardKey = null;
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
    el('h3', {}, questionFor(habitId, habit.intervalMin)),
    el('p', { className: 'hint' }, low ? meta.lowHint : meta.plantPart),
    el('div', { className: 'ask-actions' }, ...buttons),
  ];
}

function renderCard(now: number) {
  const queue = forcedHabit ? [forcedHabit] : duePrompts(settings!, state!, now);
  if (queue[0]) {
    showingDone = false;
    clearTimeout(doneTimer);
    // The key covers everything the card shows: habit, interval (question wording) and low hint.
    const habit = settings!.habits.find((h) => h.id === queue[0])!;
    setCard(questionCard(queue[0]), `${queue[0]}|${habit.intervalMin}|${state!.byId[queue[0]]!.health < 0.5}`);
  } else if (!showingDone) {
    hideCard();
  }
}

function showDone() {
  showingDone = true;
  setCard(
    [
      el('div', { className: 'ask-head' }, el('span', { className: 'ask-icon' }, icon(Sprout, 18)), el('p', { className: 'ask-eyebrow' }, 'All caught up')),
      el('h3', {}, `${capitalize(plantLabel())} is happy for now.`),
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

  if (kind === 'yes' && counts && !reduceMotion()) view.cheer(habitId === 'water' ? 'water' : 'sparkle');

  const name = catalogHabit(habitId)!.name.toLowerCase();
  if (kind === 'later') toast('Okay, I’ll ask again in 30 minutes.');
  else if (!counts) toast('Noted. That one already counted recently.');
  else toast(kind === 'yes' ? `Nice. ${capitalize(plantLabel())} felt that ${name}.` : 'No worries. Try to fit it in soon.');

  const after = computeState(s, events, now, checkpoint);
  if (duePrompts(s, after, now).length === 0) showDone();
  render();
}

// --- Data flow ---------------------------------------------------------------------------
function storageFailed(err: unknown) {
  void logError(err);
  const msg = String(err);
  toast(msg.includes('context invalidated') ? 'Marumado was updated. Reload this tab.' : 'Couldn’t save. Reload this tab and try again.');
}

async function reload() {
  try {
    [settings, events, checkpoint, gardenStored] = await Promise.all([settingsItem.getValue(), eventsItem.getValue(), checkpointItem.getValue(), gardenItem.getValue()]);
  } catch (err) {
    storageFailed(err);
  }
  loaded = true;
  render();
  refreshSettings(); // keep an open Settings drawer in sync with what's saved
}

function render() {
  if (!loaded) return;
  const now = Date.now();
  document.documentElement.classList.toggle('reduce-motion', !!settings?.reduceMotion);
  gl.setLight(!!settings?.lightMode);

  if (!settings) {
    state = null;
    gardenStored = null;
    closeNewSeedDialog();
    renderGarden();
    hideCard();
    $('needs').hidden = true;
    $('openSettings').hidden = true;
    $('openHelp').hidden = true;
    updatePlant();
    tick();
    if ($('onboarding').hidden) {
      openOnboarding(async (s, flowers) => {
        await plant(s, flowers);
        toast(`${s.plantName} is planted. See you on your next tab.`);
      });
    }
    return;
  }

  if (!$('onboarding').hidden) {
    // Planted from another tab (or restored) while this one was onboarding: close it and unlock the page.
    $('onboarding').hidden = true;
    setBackgroundInert(settingsOpen());
  }
  $('needs').hidden = false;
  $('openSettings').hidden = false;
  $('openHelp').hidden = false;
  state = computeState(settings, events, now, checkpoint);
  updatePlant();
  renderGarden();
  renderNeeds(now);
  renderCard(now);
  tick();
  void maybeRemindBackup(now);
  void maybeRemindVacation(now);

  if (gardenCheck && document.visibilityState === 'visible') {
    gardenCheck = false;
    void maybeMoveToGarden();
  }
  const g = garden();
  if (g.pendingSeed && !moving && document.visibilityState === 'visible' && !newSeedOpen()) {
    const movedPlant = g.moved.at(-1);
    openNewSeedDialog({
      moved: movedPlant?.name ?? settings.plantName,
      taken: g.moved.map((m) => m.name),
      defaultFlowers: g.current.style.flowers,
      onDone: (name, flowers) => {
        void nameNewSeed(name, flowers).then(() => toast(`${name} is planted. ${movedPlant?.name ?? 'Your ajisai'} keeps growing in the garden.`));
      },
    });
  } else if (!g.pendingSeed && newSeedOpen()) {
    closeNewSeedDialog(); // answered in another tab
  }
}

/** Vacation mode left on for weeks silently freezes the game: nudge once a day after 14 days. */
const VACATION_NUDGE_AFTER_DAYS = 14;
async function maybeRemindVacation(now: number) {
  const open = settings!.vacations.find((v) => v.to === null);
  if (!open || now - open.from < VACATION_NUDGE_AFTER_DAYS * 86_400_000 || document.visibilityState !== 'visible') return;
  const today = new Date(now).toDateString();
  if ((await vacationReminderItem.getValue()) === today) return;
  setTimeout(() => {
    toast(`${capitalize(plantLabel())} is still on vacation mode. Back at work? Turn it off in Settings.`);
    void vacationReminderItem.setValue(today);
  }, 4500);
}

/** Data lives only in this browser: nudge (at most once a day) when a backup is overdue. */
const BACKUP_FIRST_AFTER_DAYS = 14;
const BACKUP_EVERY_DAYS = 30;
async function maybeRemindBackup(now: number) {
  const s = settings!;
  const overdue = s.lastExportAt === null ? state!.calendarDay >= BACKUP_FIRST_AFTER_DAYS : now - s.lastExportAt > BACKUP_EVERY_DAYS * 86_400_000;
  if (!overdue || document.visibilityState !== 'visible') return;
  const today = new Date(now).toDateString();
  if ((await backupReminderItem.getValue()) === today) return;
  // Remember it only once it has actually been shown (the tab may close before the delay).
  setTimeout(() => {
    toast(`It’s been a while since your last backup. Settings → Export backup.`);
    void backupReminderItem.setValue(today);
  }, 1500);
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
  const cheerWater = el('button', { type: 'button' }, 'Cheer: water');
  cheerWater.addEventListener('click', () => view.cheer('water'));
  const cheerSparkle = el('button', { type: 'button' }, 'Cheer: sparkle');
  cheerSparkle.addEventListener('click', () => view.cheer('sparkle'));
  const reset = el('button', { type: 'button' }, 'Erase all data');
  reset.addEventListener('click', () => {
    if (confirm('Dev: erase settings and history?')) void clearAll();
  });
  // Time travel: push the history into the past and fill the gap with simulated answers.
  const sim = (label: string, nDays: number, pattern: Pattern, fresh = false) => {
    const b = el('button', { type: 'button' }, label);
    b.addEventListener('click', async () => {
      if (!settings) return;
      const now = Date.now();
      const back = nDays * 86_400_000;
      let st = { settings, events };
      let g = garden();
      if (fresh) {
        st = { settings: { ...settings, createdAt: now - back }, events: [] };
        g = initialGarden(st.settings, g.current.style.flowers);
      } else {
        st = shiftBack(st.settings, st.events, nDays);
        // The garden moves back in time with the history (plantedAt / movedAt).
        g = { ...g, current: { ...g.current, plantedAt: g.current.plantedAt - back }, moved: g.moved.map((m) => ({ ...m, plantedAt: m.plantedAt - back, movedAt: m.movedAt - back })) };
      }
      await replaceAll(st.settings, [...st.events, ...simulateDays(st.settings, now, nDays, pattern, now % 1000)], null, g);
      gardenCheck = true; // a simulated 6 months should trigger the move right away
      toast(`Simulated ${nDays} days (${pattern}).`);
    });
    return b;
  };
  $('mockBody').replaceChildren(
    el('label', {}, 'Sky hour', hour),
    el('label', {}, 'Plant age ', days),
    el('label', {}, 'Health', health),
    el('div', { className: 'row' }, real, reset),
    el('div', { className: 'row' }, cheerWater, cheerSparkle),
    el('label', {}, 'Simulate history'),
    el('div', { className: 'row' }, sim('30 d healthy (fresh)', 30, 'healthy', true), sim('+7 d neglect', 7, 'neglect'), sim('+7 d healthy', 7, 'healthy'), sim('+30 d mixed', 30, 'mixed')),
    el('div', { className: 'row' }, sim('+6 months healthy (→ garden)', 260, 'healthy')),
  );
}

// Dev-only hook for frame-exact video renders (deck). Not present in production builds.
if (DEV) {
  Object.assign(window, {
    __marumado: {
      manual(on: boolean) {
        manualClock = on;
      },
      set(p: { days?: number; health?: number; hour?: number }) {
        if (p.days !== undefined) preview.days = p.days;
        if (p.health !== undefined) preview.health = p.health;
        if (p.hour !== undefined) preview.hour = p.hour;
        updatePlant();
        tick();
      },
      cheer: (kind: 'water' | 'sparkle') => view.cheer(kind),
      frame(dt: number) {
        view.update(dt);
        gl.render(view.scene, view.camera);
      },
    },
  });
}

// --- Boot --------------------------------------------------------------------------------
installErrorLog();
$('openSettings').append(icon(SettingsIcon, 20));
$('openSettings').addEventListener('click', () => openSettings(true));
initSettings({ plantLabel, getSettings: () => settings, getEvents: () => events, getCheckpoint: () => checkpoint, getGarden: () => gardenStored });
initHelp({ plantName: plantLabel, reduceMotion: () => !!settings?.reduceMotion, settingsOpen });
mountDevControls();

resize();
tick();
requestAnimationFrame(loop);

watchAll(() => void reload());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  gardenCheck = true;
  void reload();
});
setInterval(render, 30_000);
// The plant panel shows itself briefly, then folds into a pill (right away on small screens).
const smallScreen = innerWidth <= 760 || innerHeight <= 700;
setTimeout(() => $('needs').classList.add('collapsed'), smallScreen ? 0 : 6000);
void reload().then(() => compactIfNeeded().catch(logError)); // once per tab: fold old history into a checkpoint
