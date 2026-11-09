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

export type BoardRole = 'responder' | 'moderator' | 'manager' | 'admin' | 'owner';
const levels: Record<BoardRole, number> = {responder:1, moderator:2, manager:3, admin:4, owner:5};
export function isBoardRole(role: unknown): role is Exclude<BoardRole, 'owner'> {
  return role === 'responder' || role === 'moderator' || role === 'manager' || role === 'admin';
}
export async function boardRole(req: NextRequest, boardId: string): Promise<BoardRole | null> {
  const db = adminDb();
  const board = await db.collection('boards').doc(boardId).get();
  if (!board.exists) return null;
  const teamId = board.get('teamId');
  if (typeof teamId !== 'string') return null;
  const user = await instructorIdentity(req);
  if (!user) return null;
  const [team, membership] = await Promise.all([
    db.collection('teams').doc(teamId).get(),
    board.ref.collection('admins').doc(user.uid).get(),
  ]);
  if (!team.exists) return null;
  if (team.get('ownerUid') === user.uid) return 'owner';
  const role = membership.get('role');
  return isBoardRole(role) ? role : null;
}
export async function canManageBoard(req: NextRequest, boardId: string, minimum: BoardRole = 'responder'): Promise<boolean> {
  const role = await boardRole(req, boardId);
  return role !== null && levels[role] >= levels[minimum];
}
