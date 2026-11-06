import test from 'node:test';
import assert from 'node:assert/strict';
import { formatNotificationTime, notificationService } from './notifications';

test('formatNotificationTime shows age relative to now', () => {
  const now = new Date('2026-11-06T12:00:00.000Z');
  assert.equal(formatNotificationTime('2026-11-06T11:59:40.000Z', now), 'Baru saja');
  assert.equal(formatNotificationTime('2026-11-06T11:55:00.000Z', now), '5 menit lalu');
  assert.equal(formatNotificationTime('2026-11-06T09:00:00.000Z', now), '3 jam lalu');
  assert.equal(formatNotificationTime('bukan tanggal', now), '');
});

test('getDeviceState recognises each device situation', () => {
  const g = globalThis as Record<string, unknown>;
  const stub = (name: string, value: unknown) => Object.defineProperty(g, name, { value, configurable: true, writable: true });
  const original = { window: g.window, navigator: g.navigator, Notification: g.Notification };
  const android = { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120', platform: 'Linux armv8l', maxTouchPoints: 5 };
  const iphone = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 };
  const browserTab = () => ({ matchMedia: () => ({ matches: false }) });
  const installedApp = () => ({ matchMedia: () => ({ matches: true }), Notification: { permission: 'default' } });

  try {
    // iPhone in a Safari tab: the API is absent and installing is the only way forward.
    stub('window', browserTab());
    stub('navigator', iphone);
    assert.equal(notificationService.getDeviceState(), 'ios-needs-install');

    // Same iPhone after "Add to Home Screen".
    stub('window', installedApp());
    stub('Notification', { permission: 'default' });
    assert.equal(notificationService.getDeviceState(), 'default');

    // Android follows the browser's permission.
    stub('window', { ...browserTab(), Notification: { permission: 'denied' } });
    stub('navigator', android);
    stub('Notification', { permission: 'denied' });
    assert.equal(notificationService.getDeviceState(), 'denied');

    // No Notification API at all.
    stub('window', browserTab());
    assert.equal(notificationService.getDeviceState(), 'unsupported');
  } finally {
    for (const [name, value] of Object.entries(original)) stub(name, value);
  }
});
