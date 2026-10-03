import { describe, expect, it } from 'vitest';
import { computeState } from '../../src/engine/model';
import { shiftBack, simulateDays } from '../../src/engine/simulate';
import { at, settings } from './helpers';

describe('simulator → model (the three deck evolutions)', () => {
  const now = at(30, 17); // Fri 30 Oct 2026, 17:00
  const base = settings({ createdAt: now - 30 * 86_400_000 });

  it('30 days healthy: grows on every workday and stays healthy', () => {
    const s = computeState(base, simulateDays(base, now, 30, 'healthy'), now);
    expect(s.careDays).toBeGreaterThanOrEqual(20);
    expect(s.health).toBeGreaterThan(0.9);
  });

  it('then a week of neglect wilts it, and a healthy week brings it back', () => {
    let st = { settings: base, events: simulateDays(base, now, 30, 'healthy') };
    st = shiftBack(st.settings, st.events, 7);
    st.events = [...st.events, ...simulateDays(st.settings, now, 7, 'neglect', 2)];
    const wilted = computeState(st.settings, st.events, now);
    expect(wilted.health).toBeLessThan(0.55);

    st = shiftBack(st.settings, st.events, 7);
    st.events = [...st.events, ...simulateDays(st.settings, now, 7, 'healthy', 3)];
    const recovered = computeState(st.settings, st.events, now);
    expect(recovered.health).toBeGreaterThan(0.9);
    expect(recovered.careDays).toBeGreaterThan(wilted.careDays);
  });
});
