import 'server-only';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { NextRequest } from 'next/server';
import { adminApp, adminDb } from './server';

export async function instructorIdentity(req: NextRequest): Promise<DecodedIdToken | null> {
  const match = /^Bearer (.+)$/.exec(req.headers.get('authorization') || '');
  if (!match) return null;
  try {
    const user = await getAuth(adminApp()).verifyIdToken(match[1], true);
    return user.email && user.email_verified === true && user.firebase.sign_in_provider !== 'anonymous' ? user : null;
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? (error as {code?: unknown}).code : undefined;
    if (typeof code === 'string' && ['auth/argument-error', 'auth/id-token-expired', 'auth/id-token-revoked', 'auth/invalid-id-token', 'auth/user-disabled', 'auth/user-not-found'].includes(code)) return null;
    // Do not misreport server credentials, permissions, or network failures as an invalid login.
    console.error('Instructor authentication service failed:', typeof code === 'string' ? code : 'unknown error');
    throw new Error('Instructor authentication service unavailable');
  }
}

export async function canManageBoard(req: NextRequest, boardId: string): Promise<boolean> {
  const db = adminDb();
  const board = await db.collection('boards').doc(boardId).get();
  if (!board.exists) return false;
  const teamId = board.get('teamId');
  if (typeof teamId !== 'string') return false;
  const user = await instructorIdentity(req);
  if (!user) return false;
  const [team, membership] = await Promise.all([
    db.collection('teams').doc(teamId).get(),
    board.ref.collection('admins').doc(user.uid).get(),
  ]);
  return team.exists && (team.get('ownerUid') === user.uid || membership.get('role') === 'admin');
}
