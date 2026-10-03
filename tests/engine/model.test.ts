import { describe, expect, it } from 'vitest';
import { computeState, potNumber, TUNING } from '../../src/engine/model';
import { shiftDatesBetween } from '../../src/engine/time';
import { at, ev, settings } from './helpers';

describe('computeState', () => {
  it('starts as a fresh sprout', () => {
    const s = computeState(settings(), [], at(5, 9, 5));
    expect(s.plantDays).toBe(0);
    expect(s.calendarDay).toBe(1);
    expect(s.byId.water!.health).toBeCloseTo(TUNING.startHealth);
  });

  it('3 "Not yet" make a healthy habit thirsty, 2 "Yes" bring it back', () => {
    const e = [ev(at(5, 9), 'water', 'yes')]; // 0.8 → 1.0
    e.push(ev(at(5, 11), 'water', 'no'), ev(at(5, 13), 'water', 'no'), ev(at(5, 15), 'water', 'no'));
    const thirsty = computeState(settings(), e, at(5, 15, 1)).byId.water!.health;
    expect(thirsty).toBeLessThan(0.55);
    expect(thirsty).toBeGreaterThan(0.4);
    e.push(ev(at(5, 17), 'water', 'yes'), ev(at(6, 9), 'water', 'yes'));
    expect(computeState(settings(), e, at(6, 9, 1)).byId.water!.health).toBeGreaterThan(0.95);
  });

  it('does not let repeated "Yes" farm health or growth', () => {
    const spam = Array.from({ length: 10 }, (_, i) => ev(at(5, 10, i), 'water', 'no'));
    const s = computeState(settings(), spam, at(5, 10, 30));
    expect(s.byId.water!.health).toBeCloseTo(TUNING.startHealth - TUNING.noLoss);
  });

  it('a care day needs more than half of the habits to get a "Yes"', () => {
    const two = [ev(at(5, 10), 'water', 'yes'), ev(at(5, 10), 'stretch', 'yes')];
    expect(computeState(settings(), two, at(5, 12)).careDays).toBe(1);
    const one = [ev(at(5, 10), 'water', 'yes')];
    expect(computeState(settings(), one, at(5, 12)).careDays).toBe(0);
    expect(potNumber(0)).toBe(1);
  });

  it('weekends neither count nor penalize', () => {
    const sat = [ev(at(10, 10), 'water', 'yes'), ev(at(10, 10), 'stretch', 'yes')];
    const s = computeState(settings({ createdAt: at(9, 9) }), sat, at(12, 8)); // Fri → Mon morning
    expect(s.careDays).toBe(0);
    expect(s.byId.eyes!.health).toBeCloseTo(TUNING.startHealth); // Fri is the grace day, Sat/Sun off
  });

  it('an ignored workday costs a little; long absences go dormant', () => {
    const oneDay = computeState(settings(), [], at(7, 8)); // Mon planted (grace), Tue ignored
    expect(oneDay.byId.water!.health).toBeCloseTo(TUNING.startHealth - TUNING.ignoredDayLoss);
    const twoWeeks = computeState(settings(), [], at(19, 8));
    expect(twoWeeks.byId.water!.health).toBeCloseTo(TUNING.startHealth - TUNING.ignoredDayLoss * TUNING.maxAbsenceDays);
    expect(twoWeeks.dormant).toBe(true);
  });

  it('vacation days are not penalized', () => {
    const s = settings({ vacations: [{ from: at(6, 0), to: at(16, 23) }] });
    expect(computeState(s, [], at(17, 8)).byId.water!.health).toBeCloseTo(TUNING.startHealth);
  });

  it('overnight shifts: 23:00 Monday and 02:00 Tuesday are the same work day', () => {
    const s = settings({ workHours: { start: '22:00', end: '06:00', days: [1, 2, 3, 4, 5] }, createdAt: at(5, 22) });
    const e = [ev(at(5, 23), 'water', 'yes'), ev(at(6, 2), 'stretch', 'yes')];
    expect(computeState(s, e, at(6, 3)).careDays).toBe(1);
  });

  it('steps calendar days correctly across a DST change (run with TZ=Europe/Madrid / America/Santiago)', () => {
    const wh = settings().workHours;
    // Europe DST ends 2026-10-25; Chile changes in early April / September.
    expect(shiftDatesBetween(at(23, 12), at(27, 12), wh)).toHaveLength(5);
    expect(shiftDatesBetween(new Date(2026, 2, 28, 12).getTime(), new Date(2026, 3, 8, 12).getTime(), wh)).toHaveLength(12);
  });

  it('ignores events from removed habits and from the future', () => {
    const e = [ev(at(5, 10), 'walk', 'yes'), ev(at(5, 20), 'water', 'no')];
    expect(computeState(settings(), e, at(5, 12)).byId.water!.health).toBeCloseTo(TUNING.startHealth);
  });
});

describe('habits added later', () => {
  it('a habit added after weeks starts fresh instead of being punished for the past', () => {
    const base = settings({ habits: [{ id: 'water', intervalMin: 120 }, { id: 'stretch', intervalMin: 60 }] });
    const e = [];
    for (let d = 5; d <= 23; d++) e.push(ev(at(d, 10), 'water', 'yes'), ev(at(d, 10), 'stretch', 'yes'));
    const added = { ...base, habits: [...base.habits, { id: 'eyes', intervalMin: 30, addedAt: at(23, 12) }] };
    const s = computeState(added, e, at(26, 8));
    expect(s.byId.eyes!.health).toBeCloseTo(TUNING.startHealth); // Mon 26: no workday since it was added has ended
  });
});
