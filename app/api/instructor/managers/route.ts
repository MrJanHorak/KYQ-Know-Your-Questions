import { createHash, randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, validId } from '../../../../lib/server';
import { canManageBoard, instructorIdentity, isBoardRole } from '../../../../lib/instructorServer';

const digest = (token:string) => createHash('sha256').update(token).digest('hex');
const noStore = {headers:{'Cache-Control':'no-store'}};

export async function GET(req:NextRequest) {
  try {
    const boardId = req.nextUrl.searchParams.get('boardId');
    if (!validId(boardId)) return NextResponse.json({error:'Invalid board.'}, {status:400});
    if (!await canManageBoard(req, boardId, 'admin')) return NextResponse.json({error:'Unauthorized.'}, {status:401});
    const db = adminDb();
    const [members, invites] = await Promise.all([db.collection('boards').doc(boardId).collection('admins').get(), db.collection('boardInvitations').where('boardId','==',boardId).get()]);
    return NextResponse.json({members:members.docs.map(doc=>({uid:doc.id, email:doc.get('email') || '', role:doc.get('role')})), invitations:invites.docs.filter(doc=>!doc.get('usedAt') && !doc.get('revokedAt') && doc.get('expiresAt') > Date.now()).map(doc=>({id:doc.id,email:doc.get('email'),role:doc.get('role'),expiresAt:doc.get('expiresAt')}))}, noStore);
  } catch { return NextResponse.json({error:'Could not load managers.'}, {status:500}); }
}

export async function POST(req:NextRequest) {
  try {
    const {boardId,email,role} = await req.json();
    if (!validId(boardId) || typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !isBoardRole(role)) return NextResponse.json({error:'Enter a valid email and role.'}, {status:400});
    if (!await canManageBoard(req,boardId,'admin')) return NextResponse.json({error:'Unauthorized.'}, {status:401});
    const token = randomBytes(32).toString('base64url');
    await adminDb().collection('boardInvitations').doc(digest(token)).create({boardId,email:email.trim().toLowerCase(),role,expiresAt:Date.now()+7*24*60*60*1000,createdAt:FieldValue.serverTimestamp()});
    return NextResponse.json({token}, noStore);
  } catch { return NextResponse.json({error:'Could not create invitation.'}, {status:500}); }
}

export async function PATCH(req:NextRequest) {
  try {
    const {boardId,uid,role} = await req.json();
    if (!validId(boardId) || !validId(uid) || !isBoardRole(role)) return NextResponse.json({error:'Invalid request.'}, {status:400});
    if (!await canManageBoard(req,boardId,'admin')) return NextResponse.json({error:'Unauthorized.'}, {status:401});
    const db=adminDb(), ref=db.collection('boards').doc(boardId).collection('admins').doc(uid);
    const changed = await db.runTransaction(async tx=>{ const member=await tx.get(ref); if (!member.exists) return false; tx.update(ref,{role}); tx.set(db.collection('instructors').doc(uid).collection('boardMemberships').doc(boardId),{role},{merge:true}); return true; });
    return changed ? NextResponse.json({ok:true}) : NextResponse.json({error:'Manager not found.'},{status:404});
  } catch { return NextResponse.json({error:'Could not update manager.'},{status:500}); }
}

export async function DELETE(req:NextRequest) {
  try {
    const {boardId,uid,invitationId} = await req.json();
    if (!validId(boardId) || (!validId(uid) && (typeof invitationId !== 'string' || !/^[a-f0-9]{64}$/.test(invitationId)))) return NextResponse.json({error:'Invalid request.'}, {status:400});
    if (!await canManageBoard(req,boardId,'admin')) return NextResponse.json({error:'Unauthorized.'}, {status:401});
    const db=adminDb();
    if (validId(uid)) { const batch=db.batch(); batch.delete(db.collection('boards').doc(boardId).collection('admins').doc(uid)); batch.delete(db.collection('instructors').doc(uid).collection('boardMemberships').doc(boardId)); await batch.commit(); }
    else { const ref=db.collection('boardInvitations').doc(invitationId); await db.runTransaction(async tx=>{const invite=await tx.get(ref); if (invite.exists && invite.get('boardId')===boardId) tx.update(ref,{revokedAt:FieldValue.serverTimestamp()});}); }
    return NextResponse.json({ok:true});
  } catch { return NextResponse.json({error:'Could not remove access.'},{status:500}); }
}

export async function PUT(req:NextRequest) {
  try {
    const user=await instructorIdentity(req);
    if (!user) return NextResponse.json({error:'Sign in with a verified account.'},{status:401});
    const {token}=await req.json();
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return NextResponse.json({error:'Invalid invitation.'},{status:400});
    const db=adminDb(), ref=db.collection('boardInvitations').doc(digest(token));
    const boardId=await db.runTransaction(async tx=>{
      const invite=await tx.get(ref), data=invite.data();
      if (!data || data.usedAt || data.revokedAt || data.expiresAt <= Date.now() || data.email !== user.email!.toLowerCase() || !isBoardRole(data.role) || !validId(data.boardId)) return null;
      const boardRef=db.collection('boards').doc(data.boardId), board=await tx.get(boardRef);
      if (!board.exists || board.get('deleting') || typeof board.get('teamId') !== 'string') return null;
      const team=await tx.get(db.collection('teams').doc(board.get('teamId')));
      if (!team.exists || team.get('ownerUid') === user.uid) return null;
      tx.set(boardRef.collection('admins').doc(user.uid),{role:data.role,email:user.email!.toLowerCase(),createdAt:FieldValue.serverTimestamp()});
      tx.set(db.collection('instructors').doc(user.uid).collection('boardMemberships').doc(data.boardId),{role:data.role});
      tx.update(ref,{usedAt:FieldValue.serverTimestamp()});
      return data.boardId as string;
    });
    return boardId ? NextResponse.json({boardId},noStore) : NextResponse.json({error:'Invitation is invalid, expired, already used, or for another email.'},{status:400});
  } catch { return NextResponse.json({error:'Could not accept invitation.'},{status:500}); }
}
