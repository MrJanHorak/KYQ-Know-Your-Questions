import { NextRequest, NextResponse } from 'next/server';
import { adminDb, isAdmin, validId } from '../../../../lib/server';
const date = (value: unknown) => value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function' ? value.toDate().toISOString() : typeof value === 'string' ? value : null;
const text = (value: unknown) => typeof value === 'string' ? value : '';
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({error:'Unauthorized'}, {status:401});
  const id = req.nextUrl.searchParams.get('boardId'); const format = req.nextUrl.searchParams.get('format');
  if (!validId(id) || !['json','md'].includes(format || '')) return NextResponse.json({error:'Invalid request'}, {status:400});
  try {
    const ref = adminDb().collection('boards').doc(id); const board = await ref.get(); if (!board.exists) return NextResponse.json({error:'Board not found'}, {status:404});
    const snap = await ref.collection('questions').orderBy('createdAt','asc').get();
    const questions = snap.docs.map(d=>{ const q=d.data(); return {id:d.id, question:text(q.question), lessonReference:text(q.lessonReference), authorName:text(q.authorName)||'Anonymous', upvoteCount:q.upvoteCount || 0, status:text(q.status), createdAt:date(q.createdAt), replies:Array.isArray(q.replies) ? q.replies.map((r: Record<string,unknown>)=>({author:text(r.author)||'Anonymous',text:text(r.text),createdAt:date(r.createdAt)})) : []}; });
    const payload = {board:{id,name:board.data()?.name}, exportedAt:new Date().toISOString(), questions};
    const markdown = [`# ${String(board.data()?.name).replace(/[\r\n]+/g,' ')}`, '', `Exported: ${payload.exportedAt}`, '', ...questions.flatMap((q,i)=>[`## Question ${i+1}`, '', q.question, '', `- **Status:** ${q.status.replace('_',' ')}`, `- **Asked by:** ${q.authorName.replace(/[\r\n]+/g,' ')}`, `- **Created:** ${q.createdAt || 'Unknown'}`, `- **Upvotes:** ${q.upvoteCount}`, ...(q.lessonReference ? [`- **Lesson or link:** ${q.lessonReference.replace(/[\r\n]+/g,' ')}`] : []), '', '### Replies', '', ...(q.replies.length ? q.replies.flatMap((r:{author:string;text:string;createdAt:string|null})=>[`**${r.author.replace(/[\r\n]+/g,' ')}**${r.createdAt ? ` · ${r.createdAt}` : ''}`, '', r.text, '']) : ['No replies yet.', ''])])].join('\n');
    return new NextResponse(format === 'json' ? JSON.stringify(payload,null,2) : markdown, {headers:{'Content-Type':format === 'json' ? 'application/json; charset=utf-8' : 'text/markdown; charset=utf-8', 'Content-Disposition':`attachment; filename="kyq-${id}.${format}"`, 'Cache-Control':'no-store'}});
  } catch { return NextResponse.json({error:'Export failed'}, {status:500}); }
}
