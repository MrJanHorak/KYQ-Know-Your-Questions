import 'server-only';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createHmac, timingSafeEqual, randomBytes, scryptSync } from 'node:crypto';
import { NextRequest } from 'next/server';
import { isIP } from 'node:net';
export function adminApp() { return getApps().find(app => app.name === 'kyq-server-v2') || initializeApp({ credential: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) : process.env.GOOGLE_APPLICATION_CREDENTIALS ? cert(process.env.GOOGLE_APPLICATION_CREDENTIALS) : applicationDefault(), projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID }, 'kyq-server-v2'); }
export function adminDb() { return getFirestore(adminApp()); }
export function hashPassword(password: string) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; }
export function checkPassword(password: string, stored: string) { const [salt, hash] = stored.split(':'); if (!/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(hash || '')) return false; return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, 'hex')); }
export const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
// Store attempt counters in Firestore so limits survive serverless cold starts.
export async function reservePasswordAttempt(req: NextRequest, scope: string, uid: string): Promise<null | (() => Promise<void>)> {
  // Only Vercel's ingress is trusted to supply this header. On other hosts,
  // or if the header is missing or malformed, share a conservative bucket.
  const forwarded = process.env.VERCEL === '1' ? req.headers.get('x-vercel-forwarded-for')?.trim().toLowerCase() : undefined;
  const ip = forwarded && isIP(forwarded) ? forwarded : 'unknown';
  if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is required for password attempt limiting');
  const db = adminDb();
  const ref = (kind: string, value: string) => db.collection('_passwordAttempts').doc(createHmac('sha256', process.env.SESSION_SECRET!).update(JSON.stringify([scope, kind, value])).digest('hex'));
  const buckets = [{ ref: ref('uid', uid), max: 10 }, { ref: ref('ip', ip), max: 50 }];
  const now = Date.now(), windowMs = 10 * 60 * 1000;
  const windows = await db.runTransaction(async tx => {
    const snapshots = await Promise.all(buckets.map(bucket => tx.get(bucket.ref)));
    const states = snapshots.map(snapshot => {
      const data = snapshot.data();
      const active = data && typeof data.startedAt === 'number' && now - data.startedAt < windowMs;
      return { startedAt: active ? data.startedAt as number : now, count: active && typeof data.count === 'number' ? data.count as number : 0 };
    });
    if (states.some((state, index) => state.count >= buckets[index].max)) return null;
    buckets.forEach((bucket, index) => tx.set(bucket.ref, { startedAt: states[index].startedAt, count: states[index].count + 1 }));
    return states.map(state => state.startedAt);
  });
  if (!windows) return null;
  // Successful checks return their reservation; in-flight guesses remain counted.
  return async () => { await db.runTransaction(async tx => {
    const snapshots = await Promise.all(buckets.map(bucket => tx.get(bucket.ref)));
    snapshots.forEach((snapshot, index) => {
      const data = snapshot.data();
      if (data?.startedAt === windows[index] && typeof data.count === 'number' && data.count > 0) tx.update(buckets[index].ref, { count: data.count - 1 });
    });
  }); };
}
