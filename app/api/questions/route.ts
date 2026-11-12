import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { adminApp, adminDb, validId } from '../../../lib/server';

export async function POST(req: NextRequest) {
  try {
    const { boardId, question, lessonReference, authorName, idToken } = await req.json();
    if (!validId(boardId) || typeof idToken !== 'string' || typeof question !== 'string' || !question.trim() || question.length > 2000 || typeof lessonReference !== 'string' || lessonReference.length > 500 || typeof authorName !== 'string' || authorName.length > 80) return NextResponse.json({ error: 'Invalid question.' }, { status: 400 });
    let user;
    try { user = await getAuth(adminApp()).verifyIdToken(idToken); }
    catch { return NextResponse.json({ error: 'Please unlock the board again.' }, { status: 401 }); }
    if (user.boardId !== boardId) return NextResponse.json({ error: 'Board access required.' }, { status: 403 });
    const db = adminDb();
    const boardRef = db.collection('boards').doc(boardId);
    const limitRef = boardRef.collection('_questionCooldowns').doc(user.uid);
    const result = await db.runTransaction(async tx => {
      const [board, limit] = await Promise.all([tx.get(boardRef), tx.get(limitRef)]);
      if (!board.exists || typeof board.get('teamId') !== 'string' || board.get('deleting') || (board.get('accessVersion') ?? 0) !== (user.accessVersion ?? 0)) return 403;
      if (typeof user.managerUid === 'string') {
        const teamRef = db.collection('teams').doc(board.get('teamId'));
        const [security, team, owner, member] = await Promise.all([tx.get(db.collection('_settings').doc('security')), tx.get(teamRef), tx.get(teamRef.collection('members').doc(user.managerUid)), tx.get(boardRef.collection('admins').doc(user.managerUid))]);
        if ((security.get('requireInstructorMfa') === true && user.managerMfa !== true) || !team.exists || (owner.get('role') !== 'owner' && !['responder', 'moderator', 'manager', 'admin'].includes(member.get('role')))) return 403;
      }
      const now = Date.now();
      if (typeof limit.get('lastPostedAt') === 'number' && now - limit.get('lastPostedAt') < 15000) return 429;
      tx.set(limitRef, { lastPostedAt: now });
      tx.create(boardRef.collection('questions').doc(), { question: question.trim(), lessonReference: lessonReference.trim(), authorName: authorName.trim() || 'Anonymous', authorUid: user.uid, upvotes: [], upvoteCount: 0, status: 'unanswered', createdAt: FieldValue.serverTimestamp(), replies: [] });
      return 200;
    });
    return result === 200 ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result === 429 ? 'Please wait before posting another question.' : 'Board access changed. Please unlock the board again.' }, { status: result });
  } catch { return NextResponse.json({ error: 'Could not post the question.' }, { status: 500 }); }
}
