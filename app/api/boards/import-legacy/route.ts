import { NextRequest, NextResponse } from 'next/server';
import { adminDb, isAdmin, validId } from '../../../../lib/server';
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({error:'Unauthorized'}, {status:401});
  try { const { boardId } = await req.json(); if (!validId(boardId)) return NextResponse.json({error:'Invalid board'}, {status:400});
    const db = adminDb(); const board = db.collection('boards').doc(boardId); if (!(await board.get()).exists) return NextResponse.json({error:'Board not found'}, {status:404});
    const source = await db.collection('questions').get(); let added=0; let existing=0;
    for (const old of source.docs) { const target = board.collection('questions').doc(`legacy_${old.id}`); const created = await db.runTransaction(async tx=>{const snapshot=await tx.get(target); if(snapshot.exists) return false; tx.create(target, old.data()); return true;}); if(created) added++; else existing++; }
    return NextResponse.json({added,existing});
  } catch { return NextResponse.json({error:'Import failed. Try again; already imported questions will not be duplicated.'}, {status:500}); }
}
