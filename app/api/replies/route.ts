import { randomUUID } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { NextRequest, NextResponse } from 'next/server';
import { adminApp, adminDb, validId } from '../../../lib/server';

async function changeReply(req: NextRequest, edit: boolean) {
  try {
    const { boardId, questionId, replyId, text, author, idToken } = await req.json();
    if (!validId(boardId) || !validId(questionId) || (edit && !validId(replyId)) ||
        typeof text !== 'string' || !text.trim() || text.length > 2000 ||
        (!edit && (typeof author !== 'string' || author.length > 80)) || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Invalid reply.' }, { status: 400 });
    }
    let user;
    try { user = await getAuth(adminApp()).verifyIdToken(idToken); }
    catch { return NextResponse.json({ error: 'Please unlock the board again.' }, { status: 401 }); }
    if (user.boardId !== boardId) return NextResponse.json({ error: 'Board access required.' }, { status: 403 });
    const db = adminDb();
    const boardRef = db.collection('boards').doc(boardId);
    const questionRef = boardRef.collection('questions').doc(questionId);
    const result = await db.runTransaction(async tx => {
      const [board, question] = await Promise.all([tx.get(boardRef), tx.get(questionRef)]);
      if (!board.exists || typeof board.data()?.teamId !== 'string' || board.data()?.deleting || (board.data()?.accessVersion ?? 0) !== (user.accessVersion ?? 0)) return 403;
      if (typeof user.managerUid === 'string') {
        const teamRef = db.collection('teams').doc(board.data()!.teamId);
        const [team, owner, member] = await Promise.all([tx.get(teamRef), tx.get(teamRef.collection('members').doc(user.managerUid)), tx.get(boardRef.collection('admins').doc(user.managerUid))]);
        if (!team.exists || (owner.get('role') !== 'owner' && !['responder','moderator','manager','admin'].includes(member.get('role')))) return 403;
      }
      if (!question.exists) return 404;
      const replies = question.data()?.replies;
      if (!Array.isArray(replies)) return 400;
      if (edit) {
        const index = replies.findIndex(reply => reply.id === replyId);
        if (index < 0) return 404;
        if (replies[index].authorUid !== user.uid) return 403;
        replies[index] = { ...replies[index], text: text.trim() };
      } else {
        replies.push({ id: randomUUID(), authorUid: user.uid, author: author.trim() || 'Anonymous', text: text.trim(), createdAt: new Date().toISOString() });
      }
      tx.update(questionRef, { replies });
      return 200;
    });
    return result === 200 ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Could not save the reply.' }, { status: result });
  } catch { return NextResponse.json({ error: 'Could not save the reply.' }, { status: 500 }); }
}
export async function POST(req: NextRequest) { return changeReply(req, false); }
export async function PATCH(req: NextRequest) { return changeReply(req, true); }
