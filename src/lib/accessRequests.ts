import { FirebaseError } from 'firebase/app';
import { PendingUserApproval } from '../types';

/**
 * Firestore collection of Google accounts waiting for a Super Admin's approval, one document per
 * Firebase uid. It is the only copy of the queue, so every admin on every device sees the same list.
 */
export const ACCESS_REQUESTS_COLLECTION = 'pending_approvals';

/** How often a request or a queue read that Firestore refused is tried again. */
export const ACCESS_REQUEST_RETRY_MS = 30_000;

/** Short error code shown on screen, e.g. "permission-denied". */
export function firestoreErrorCode(err: unknown): string {
  return err instanceof FirebaseError ? err.code : 'unknown';
}

/** The id is the document id, because that is what approving or rejecting a request deletes. */
export function toPendingApprovals(docs: { id: string; data: Record<string, unknown> }[]): PendingUserApproval[] {
  return docs
    .map(({ id, data }) => {
      const email = typeof data.email === 'string' ? data.email : '';
      const displayName = typeof data.displayName === 'string' ? data.displayName : '';
      return {
        id,
        uid: typeof data.uid === 'string' ? data.uid : id,
        email,
        displayName: displayName || email.split('@')[0],
        avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : undefined,
        requestedAt: typeof data.requestedAt === 'string' ? data.requestedAt : '',
        status: 'pending' as const,
      };
    })
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}
