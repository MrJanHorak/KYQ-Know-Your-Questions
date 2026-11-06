import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, hashPassword, validId } from '../../../../lib/server';
import { instructorIdentity } from '../../../../lib/instructorServer';

export async function GET(req: NextRequest) {
  const user = await instructorIdentity(req);
  if (!user) return NextResponse.json({error:'Sign in required.'}, {status:401});
  try {
    const db = adminDb();
    const instructor = await db.collection('instructors').doc(user.uid).get();
    const teamId = instructor.get('personalTeamId');
    if (typeof teamId !== 'string') return NextResponse.json({error:'Set up your account first.'}, {status:403});
    const team = await db.collection('teams').doc(teamId).get();
    if (!team.exists || team.get('ownerUid') !== user.uid) return NextResponse.json({error:'Team unavailable.'}, {status:403});
    const cursor = req.nextUrl.searchParams.get('after');
    if (cursor && !validId(cursor)) return NextResponse.json({error:'Invalid page.'}, {status:400});
    let query = db.collection('boards').where('teamId', '==', teamId).orderBy(FieldPath.documentId()).limit(51);
    if (cursor) query = query.startAfter(cursor);
    const result = await query.get();
    const page = result.docs.slice(0,50);
    return NextResponse.json({boards:page.filter(board => !board.get('deleting')).map(board => ({id:board.id, name:board.get('name')})), nextCursor:result.size > 50 ? page[page.length-1].id : null}, {headers:{'Cache-Control':'no-store'}});
  } catch { return NextResponse.json({error:'Could not load boards.'}, {status:500}); }
}

export async function POST(req: NextRequest) {
  const user = await instructorIdentity(req);
  if (!user) return NextResponse.json({error:'Sign in required.'}, {status:401});
  try {
    const {name, password} = await req.json();
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 || typeof password !== 'string' || password.length < 8 || password.length > 128) return NextResponse.json({error:'Use a name and a password of 8–128 characters.'}, {status:400});
    const db = adminDb();
    const instructor = await db.collection('instructors').doc(user.uid).get();
    const teamId = instructor.get('personalTeamId');
    if (typeof teamId !== 'string') return NextResponse.json({error:'Set up your account first.'}, {status:403});
    const team = await db.collection('teams').doc(teamId).get();
    if (!team.exists || team.get('ownerUid') !== user.uid) return NextResponse.json({error:'Team unavailable.'}, {status:403});
    const board = await db.collection('boards').add({teamId, name:name.trim(), passwordHash:hashPassword(password), accessVersion:0, createdAt:FieldValue.serverTimestamp()});
    return NextResponse.json({id:board.id, name:name.trim()});
  } catch { return NextResponse.json({error:'Could not create board.'}, {status:500}); }
}
