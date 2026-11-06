import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, validId } from '../../../../lib/server';
import { canManageBoard } from '../../../../lib/instructorServer';

export async function DELETE(req: NextRequest, {params}: {params: Promise<{boardId:string}>}) {
  const {boardId} = await params;
  if (!validId(boardId)) return NextResponse.json({error:'Invalid board'}, {status:400});
  try {
    if (!await canManageBoard(req, boardId)) return NextResponse.json({error:'Unauthorized'}, {status:401});
    const db = adminDb();
    const ref = db.collection('boards').doc(boardId);
    const exists = await db.runTransaction(async tx => {
      const board = await tx.get(ref);
      if (!board.exists) return false;
      // Block new grants and invalidate existing grants before removing questions.
      if (!board.data()?.deleting) tx.update(ref, {deleting:true, accessVersion:FieldValue.increment(1)});
      return true;
    });
    if (!exists) return NextResponse.json({error:'Board not found'}, {status:404});
    // Keep the board document until every child collection is removed, so a
    // partial failure can be retried without leaving unreachable descendants.
    for (const collection of await ref.listCollections()) await db.recursiveDelete(collection);
    await ref.delete();
    return NextResponse.json({ok:true}, {headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    console.error('Board deletion failed:', error);
    return NextResponse.json({error:'Could not delete the board completely. Try deleting it again.'}, {status:500});
  }
}
