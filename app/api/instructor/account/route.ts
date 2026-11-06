import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { adminApp, adminDb } from '../../../../lib/server';

// This endpoint creates only the caller's own team; clients cannot pick an owner.
export async function POST(req: NextRequest) {
  const match = /^Bearer (.+)$/.exec(req.headers.get('authorization') || '');
  if (!match) return NextResponse.json({error:'Sign in required.'}, {status:401});
  let identity;
  try { identity = await getAuth(adminApp()).verifyIdToken(match[1], true); }
  catch { return NextResponse.json({error:'Your session has expired. Sign in again.'}, {status:401}); }
  if (!identity.email || identity.email_verified !== true || identity.firebase.sign_in_provider === 'anonymous') {
    return NextResponse.json({error:'Verify your email before creating your team.'}, {status:403});
  }
  try {
    const db = adminDb();
    const userRef = db.collection('instructors').doc(identity.uid);
    const teamRef = db.collection('teams').doc();
    const teamId = await db.runTransaction(async tx => {
      const user = await tx.get(userRef);
      if (user.exists) return user.get('personalTeamId') as string;
      tx.create(teamRef, {ownerUid:identity.uid, createdAt:FieldValue.serverTimestamp()});
      tx.create(teamRef.collection('members').doc(identity.uid), {role:'owner', createdAt:FieldValue.serverTimestamp()});
      tx.create(userRef, {personalTeamId:teamRef.id, createdAt:FieldValue.serverTimestamp()});
      return teamRef.id;
    });
    return NextResponse.json({teamId}, {headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    console.error('Instructor account setup failed:', error);
    return NextResponse.json({error:'Could not set up your instructor account. Please try again.'}, {status:500});
  }
}
