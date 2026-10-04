import { describe, expect, it } from 'vitest';
import { makeBackup, parseBackup, SCHEMA_VERSION } from '../../src/engine/backup';
import { at, ev, settings } from './helpers';

describe('backup', () => {
  const good = makeBackup(settings(), [ev(at(5, 10), 'water', 'yes')], at(6, 9));

  it('round-trips', () => {
    const r = parseBackup(JSON.stringify(good));
    expect(r.ok && r.backup.events).toHaveLength(1);
    expect(r.ok && r.backup.settings.plantName).toBe('Aoi');
  });

  it.each([
    ['not json', '{oops'],
    ['another app', JSON.stringify({ app: 'momentum' })],
    ['newer schema', JSON.stringify({ ...good, schemaVersion: SCHEMA_VERSION + 1 })],
    ['unknown habit', JSON.stringify({ ...good, settings: { ...good.settings, habits: [{ id: 'coffee', intervalMin: 60 }] } })],
    ['bad hours', JSON.stringify({ ...good, settings: { ...good.settings, workHours: { start: '25:00', end: '18:00', days: [1] } } })],
    ['damaged event', JSON.stringify({ ...good, events: [{ id: 1 }] })],
  ])('rejects %s', (_, text) => {
    expect(parseBackup(text).ok).toBe(false);
  });
});

describe('backup v2: garden', () => {
  it('round-trips the garden; restores v1 backups (no garden); rejects a damaged garden', async () => {
    const { initialGarden, moveToGarden } = await import('../../src/engine/garden');
    const s = settings();
    const garden = moveToGarden(initialGarden(s, 'pink'), { careDays: 130 } as never, at(20, 9), { id: 'g1', name: 'Hana' });
    const v2 = parseBackup(JSON.stringify(makeBackup(s, [], at(21, 9), [], null, garden)));
    expect(v2.ok && v2.backup.garden?.moved[0]?.name).toBe('Hana');
    const v1 = parseBackup(JSON.stringify({ ...makeBackup(s, [], at(21, 9)), schemaVersion: 1, garden: undefined }));
    expect(v1.ok && v1.backup.garden).toBeNull();
    const bad = parseBackup(JSON.stringify({ ...makeBackup(s, [], at(21, 9)), garden: { current: {}, moved: [] } }));
    expect(bad.ok).toBe(false);
  });
});
