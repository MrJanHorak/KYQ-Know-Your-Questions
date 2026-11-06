import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/server';
import { instructorIdentity } from '../../../../lib/instructorServer';

// This endpoint creates only the caller's own team; clients cannot pick an owner.
export async function POST(req: NextRequest) {
  let identity;
  try { identity = await instructorIdentity(req); }
  catch { return NextResponse.json({error:'The server cannot verify instructor accounts right now. Please contact the site administrator.'}, {status:503}); }
  if (!identity) return NextResponse.json({error:'Sign in with a verified instructor account.'}, {status:401});
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
