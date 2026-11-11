import { createHash, randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, validId } from '../../../../lib/server';
import { instructorIdentity } from '../../../../lib/instructorServer';

const digest = (token:string) => createHash('sha256').update(token).digest('hex');
const noStore = {headers:{'Cache-Control':'no-store'}};
const recent = (authTime:number) => Number.isFinite(authTime) && authTime <= Date.now()/1000 + 60 && authTime > Date.now()/1000 - 600;

export async function GET(req:NextRequest) {
  try {
    const user = await instructorIdentity(req);
    if (!user) return NextResponse.json({error:'Sign in required.'},{status:401});
    const db=adminDb(), teamId=req.nextUrl.searchParams.get('teamId');
    if (!teamId) {
      const [profile, memberships]=await Promise.all([db.collection('instructors').doc(user.uid).get(),db.collection('instructors').doc(user.uid).collection('teamMemberships').get()]);
      const ids=new Set(memberships.docs.map(d=>d.id));
      if (validId(profile.get('personalTeamId'))) ids.add(profile.get('personalTeamId'));
      const teams=await Promise.all([...ids].map(async id=>{const ref=db.collection('teams').doc(id); const [team, member]=await Promise.all([ref.get(),ref.collection('members').doc(user.uid).get()]); return team.exists && member.get('role')==='owner' ? {id,personal:id===profile.get('personalTeamId')} : null;}));
      return NextResponse.json({teams:teams.filter(Boolean)},noStore);
    }
    if (!validId(teamId)) return NextResponse.json({error:'Invalid team.'},{status:400});
    const ref=db.collection('teams').doc(teamId);
    if (!(await ref.get()).exists || (await ref.collection('members').doc(user.uid).get()).get('role')!=='owner') return NextResponse.json({error:'Unauthorized.'},{status:403});
    const [members,invites,events]=await Promise.all([ref.collection('members').where('role','==','owner').get(),db.collection('teamInvitations').where('teamId','==',teamId).get(),ref.collection('ownershipEvents').orderBy('createdAt','desc').limit(20).get()]);
    return NextResponse.json({members:members.docs.map(d=>({uid:d.id,email:d.get('email') || ''})),invitations:invites.docs.filter(d=>!d.get('usedAt')&&!d.get('revokedAt')&&d.get('expiresAt')>Date.now()).map(d=>({id:d.id,email:d.get('email')})),events:events.docs.map(d=>({id:d.id,action:d.get('action'),actor:d.get('actor'),target:d.get('target')}))},noStore);
  } catch { return NextResponse.json({error:'Could not load team owners.'},{status:500}); }
}

export async function POST(req:NextRequest) {
  try {
    const user=await instructorIdentity(req);
    if (!user) return NextResponse.json({error:'Sign in required.'},{status:401});
    if (!recent(user.auth_time)) return NextResponse.json({error:'Please sign in again before changing ownership.'},{status:403});
    const {teamId,email}=await req.json();
    if (!validId(teamId)||typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return NextResponse.json({error:'Enter a valid email.'},{status:400});
    const db=adminDb(), ref=db.collection('teams').doc(teamId), token=randomBytes(32).toString('base64url'), target=email.trim().toLowerCase();
    const ok=await db.runTransaction(async tx=>{const [team,member]=await Promise.all([tx.get(ref),tx.get(ref.collection('members').doc(user.uid))]); if(!team.exists||member.get('role')!=='owner') return false; tx.create(db.collection('teamInvitations').doc(digest(token)),{teamId,email:target,expiresAt:Date.now()+7*86400000,createdAt:FieldValue.serverTimestamp()}); tx.create(ref.collection('ownershipEvents').doc(),{action:'invited',actor:user.email,target,createdAt:FieldValue.serverTimestamp()}); return true;});
    return ok ? NextResponse.json({token},noStore) : NextResponse.json({error:'Unauthorized.'},{status:403});
  } catch {return NextResponse.json({error:'Could not create invitation.'},{status:500});}
}

export async function PUT(req:NextRequest) {
  try {
    const user=await instructorIdentity(req);
    if (!user) return NextResponse.json({error:'Sign in required.'},{status:401});
    if (!recent(user.auth_time)) return NextResponse.json({error:'Please sign in again before accepting ownership.'},{status:403});
    const {token}=await req.json();
    if (typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token)) return NextResponse.json({error:'Invalid invitation.'},{status:400});
    const db=adminDb(), inviteRef=db.collection('teamInvitations').doc(digest(token));
    const teamId=await db.runTransaction(async tx=>{const invite=await tx.get(inviteRef), data=invite.data(); if(!data||data.usedAt||data.revokedAt||data.expiresAt<=Date.now()||data.email!==user.email!.toLowerCase()||!validId(data.teamId)) return null; const ref=db.collection('teams').doc(data.teamId); const [team,member]=await Promise.all([tx.get(ref),tx.get(ref.collection('members').doc(user.uid))]); if(!team.exists||member.get('role')==='owner') return null; tx.set(ref.collection('members').doc(user.uid),{role:'owner',email:user.email!.toLowerCase(),createdAt:FieldValue.serverTimestamp()}); tx.set(db.collection('instructors').doc(user.uid).collection('teamMemberships').doc(data.teamId),{role:'owner'}); tx.update(inviteRef,{usedAt:FieldValue.serverTimestamp()}); tx.update(ref,{ownershipUpdatedAt:FieldValue.serverTimestamp()}); tx.create(ref.collection('ownershipEvents').doc(),{action:'accepted ownership',actor:user.email,target:user.email,createdAt:FieldValue.serverTimestamp()}); return data.teamId as string;});
    return teamId ? NextResponse.json({teamId},noStore) : NextResponse.json({error:'Invitation is invalid, expired, used, or for another email.'},{status:400});
  } catch {return NextResponse.json({error:'Could not accept invitation.'},{status:500});}
}

export async function DELETE(req:NextRequest) {
  try {
    const user=await instructorIdentity(req);
    if(!user) return NextResponse.json({error:'Sign in required.'},{status:401});
    if(!recent(user.auth_time)) return NextResponse.json({error:'Please sign in again before changing ownership.'},{status:403});
    const {teamId,uid,invitationId}=await req.json();
    if(!validId(teamId)||(!validId(uid)&&(typeof invitationId!=='string'||!/^[a-f0-9]{64}$/.test(invitationId)))) return NextResponse.json({error:'Invalid request.'},{status:400});
    const db=adminDb(), ref=db.collection('teams').doc(teamId);
    const result=await db.runTransaction(async tx=>{const [team,actor]=await Promise.all([tx.get(ref),tx.get(ref.collection('members').doc(user.uid))]); if(!team.exists||actor.get('role')!=='owner') return 'unauthorized'; if(validId(uid)){const [target,owners]=await Promise.all([tx.get(ref.collection('members').doc(uid)),tx.get(ref.collection('members').where('role','==','owner'))]); if(target.get('role')!=='owner') return 'missing'; if(owners.size<=1) return 'last'; tx.delete(target.ref); tx.delete(db.collection('instructors').doc(uid).collection('teamMemberships').doc(teamId)); tx.update(ref,{ownershipUpdatedAt:FieldValue.serverTimestamp()}); tx.create(ref.collection('ownershipEvents').doc(),{action:'removed owner',actor:user.email,target:target.get('email')||uid,createdAt:FieldValue.serverTimestamp()});} else {const inviteRef=db.collection('teamInvitations').doc(invitationId), invite=await tx.get(inviteRef); if(!invite.exists||invite.get('teamId')!==teamId) return 'missing'; tx.update(inviteRef,{revokedAt:FieldValue.serverTimestamp()}); tx.create(ref.collection('ownershipEvents').doc(),{action:'revoked invitation',actor:user.email,target:invite.get('email'),createdAt:FieldValue.serverTimestamp()});} return 'ok';});
    return result==='ok' ? NextResponse.json({ok:true}) : NextResponse.json({error:result==='last'?'A team must retain at least one owner.':result==='unauthorized'?'Unauthorized.':'Owner or invitation not found.'},{status:result==='unauthorized'?403:400});
  } catch {return NextResponse.json({error:'Could not update ownership.'},{status:500});}
}
