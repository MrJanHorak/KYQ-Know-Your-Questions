import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, hashPassword, isAdmin, validId } from '../../../../lib/server';

export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({error:'Unauthorized'}, {status:401});
  try {
    const {boardId, password} = await req.json();
    if (!validId(boardId) || typeof password !== 'string' || password.length < 8 || password.length > 128) return NextResponse.json({error:'Use a password of 8–128 characters.'}, {status:400});
    const ref = adminDb().collection('boards').doc(boardId);
    const passwordHash = hashPassword(password);
    const updated = await adminDb().runTransaction(async tx => {
      if (!(await tx.get(ref)).exists) return false;
      tx.update(ref, {passwordHash, accessVersion:FieldValue.increment(1)});
      return true;
    });
    if (!updated) return NextResponse.json({error:'Board not found'}, {status:404});
    return NextResponse.json({ok:true}, {headers:{'Cache-Control':'no-store'}});
  } catch { return NextResponse.json({error:'Could not change password'}, {status:500}); }
}
