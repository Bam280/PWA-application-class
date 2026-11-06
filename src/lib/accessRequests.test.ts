import test from 'node:test';
import assert from 'node:assert/strict';
import { FirebaseError } from 'firebase/app';
import { firestoreErrorCode, toPendingApprovals } from './accessRequests';

const request = (uid: string, requestedAt: string) => ({
  id: uid,
  data: { uid, email: `${uid}@example.com`, displayName: uid, requestedAt, status: 'pending' },
});

test('each request keeps its document id, even when filed in the same millisecond', () => {
  const at = '2026-11-06T10:00:00.000Z';
  const list = toPendingApprovals([request('a', at), request('b', at), request('c', at)]);
  assert.deepEqual(list.map(p => p.id).sort(), ['a', 'b', 'c']);
});

test('newest request comes first', () => {
  const list = toPendingApprovals([request('old', '2026-11-05T10:00:00.000Z'), request('new', '2026-11-06T10:00:00.000Z')]);
  assert.deepEqual(list.map(p => p.id), ['new', 'old']);
});

test('a request with missing fields still shows who it is from', () => {
  const [p] = toPendingApprovals([{ id: 'x', data: { email: 'budi@example.com', avatarUrl: null } }]);
  assert.equal(p.uid, 'x');
  assert.equal(p.displayName, 'budi');
  assert.equal(p.avatarUrl, undefined);
  assert.equal(p.requestedAt, '');
});

test('firestoreErrorCode reads the code that is shown on screen', () => {
  assert.equal(firestoreErrorCode(new FirebaseError('permission-denied', 'denied')), 'permission-denied');
  assert.equal(firestoreErrorCode(new Error('x')), 'unknown');
});
