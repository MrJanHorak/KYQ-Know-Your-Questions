import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/server';
import { instructorIdentity, isBoardRole } from '../../../../lib/instructorServer';

export async function GET(req:NextRequest) {
  try {
    const user=await instructorIdentity(req);
    if (!user) return NextResponse.json({error:'Sign in required.'},{status:401});
    const db=adminDb();
    const memberships=await db.collection('instructors').doc(user.uid).collection('boardMemberships').get();
    const boards=await Promise.all(memberships.docs.map(async entry=>{
      const ref=db.collection('boards').doc(entry.id);
      const [board,member]=await Promise.all([ref.get(),ref.collection('admins').doc(user.uid).get()]);
      if (!board.exists || !isBoardRole(member.get('role'))) return null;
      const teamId=board.get('teamId');
      if (typeof teamId==='string' && (await db.collection('teams').doc(teamId).collection('members').doc(user.uid).get()).get('role')==='owner') return null;
      return {id:board.id,name:board.get('name'),deleting:board.get('deleting')===true,role:member.get('role')};
    }));
    return NextResponse.json({boards:boards.filter(Boolean)}, {headers:{'Cache-Control':'no-store'}});
  } catch { return NextResponse.json({error:'Could not load shared boards.'},{status:500}); }
}
