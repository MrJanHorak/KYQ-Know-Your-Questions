import 'server-only';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createHmac, timingSafeEqual, randomBytes, scryptSync } from 'node:crypto';
import { NextRequest } from 'next/server';
export function adminApp() { return getApps()[0] || initializeApp({ credential: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) : process.env.GOOGLE_APPLICATION_CREDENTIALS ? cert(process.env.GOOGLE_APPLICATION_CREDENTIALS) : applicationDefault(), projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID }); }
export function adminDb() { return getFirestore(adminApp()); }
export function adminToken() { const expires = String(Date.now() + 8 * 60 * 60 * 1000); const signature = createHmac('sha256', process.env.SESSION_SECRET || '').update(`kyq-admin:${expires}`).digest('hex'); return `${expires}.${signature}`; }
export function isAdmin(req: NextRequest) { const supplied = req.cookies.get('kyq-admin')?.value || ''; const match = /^(\d{13})\.([a-f0-9]{64})$/.exec(supplied); if (!process.env.SESSION_SECRET || !match || Number(match[1]) <= Date.now()) return false; const expected = createHmac('sha256', process.env.SESSION_SECRET).update(`kyq-admin:${match[1]}`).digest(); return timingSafeEqual(Buffer.from(match[2], 'hex'), expected); }
export function hashPassword(password: string) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; }
export function checkPassword(password: string, stored: string) { const [salt, hash] = stored.split(':'); if (!/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(hash || '')) return false; return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, 'hex')); }
export const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
// Store attempt counters in Firestore so limits survive serverless cold starts.
export async function allowPasswordAttempt(req: NextRequest, scope: string) {
  const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const key = createHmac('sha256', process.env.SESSION_SECRET || '').update(`${scope}:${ip}`).digest('hex');
  const ref = adminDb().collection('_passwordAttempts').doc(key); const now = Date.now(); const windowMs = 10 * 60 * 1000;
  return adminDb().runTransaction(async tx => { const snap = await tx.get(ref); const data = snap.data(); const active = data && typeof data.startedAt === 'number' && now - data.startedAt < windowMs; const count = active ? data.count : 0; if (count >= 10) return false; tx.set(ref,{startedAt:active ? data.startedAt : now, count:count + 1}); return true; });
}
