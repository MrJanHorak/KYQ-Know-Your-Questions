import { createHash, randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, validId } from '../../../../lib/server';
import { instructorIdentity } from '../../../../lib/instructorServer';

const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
const noStore={headers:{'Cache-Control':'no-store'}};
const recent=(time:number)=>Number.isFinite(time)&&time<=Date.now()/1000+60&&time>Date.now()/1000-600;
const unauthorized=()=>NextResponse.json({error:'Unauthorized.'},{status:403});

export async function GET(req:NextRequest) {
  try {
    const user=await instructorIdentity(req); if(!user) return NextResponse.json({error:'Sign in required.'},{status:401});
    const db=adminDb(), teamId=req.nextUrl.searchParams.get('teamId');
    if(!teamId) {
      const entries=await db.collection('instructors').doc(user.uid).collection('recoveryTeams').get();
      const teams=await Promise.all(entries.docs.map(async entry=>{const team=await db.collection('teams').doc(entry.id).get();return team.exists&&team.get('recoveryContactUid')===user.uid?{id:entry.id}:null;}));
      return NextResponse.json({teams:teams.filter(Boolean)},noStore);
    }
    if(!validId(teamId)) return NextResponse.json({error:'Invalid team.'},{status:400});
    const ref=db.collection('teams').doc(teamId), [team,owner]=await Promise.all([ref.get(),ref.collection('members').doc(user.uid).get()]);
    if(!team.exists||owner.get('role')!=='owner') return unauthorized();
    return NextResponse.json({contact:team.get('recoveryContactEmail')||null,pending:team.get('recoveryInviteExpiresAt')>Date.now()?team.get('recoveryInviteEmail'):null},noStore);
  } catch {return NextResponse.json({error:'Could not load recovery contact.'},{status:500});}
}

export async function POST(req:NextRequest) {
  try {
    const user=await instructorIdentity(req);if(!user)return NextResponse.json({error:'Sign in required.'},{status:401});if(!recent(user.auth_time))return NextResponse.json({error:'Please sign in again.'},{status:403});
    const {teamId,email}=await req.json();if(!validId(teamId)||typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))return NextResponse.json({error:'Enter a valid email.'},{status:400});
    const db=adminDb(),ref=db.collection('teams').doc(teamId),token=randomBytes(32).toString('base64url'),target=email.trim().toLowerCase();
    const ok=await db.runTransaction(async tx=>{const [team,owner]=await Promise.all([tx.get(ref),tx.get(ref.collection('members').doc(user.uid))]);if(!team.exists||owner.get('role')!=='owner')return false;tx.update(ref,{recoveryInviteHash:digest(token),recoveryInviteEmail:target,recoveryInviteExpiresAt:Date.now()+7*86400000});tx.create(ref.collection('ownershipEvents').doc(),{action:'invited recovery contact',actor:user.email,target,createdAt:FieldValue.serverTimestamp()});return true;});
    return ok?NextResponse.json({token},noStore):unauthorized();
  }catch{return NextResponse.json({error:'Could not create recovery invitation.'},{status:500});}
}

export async function PUT(req:NextRequest) {
  try {
    const user=await instructorIdentity(req);if(!user)return NextResponse.json({error:'Sign in required.'},{status:401});if(!recent(user.auth_time))return NextResponse.json({error:'Please sign in again.'},{status:403});
    const {teamId,token}=await req.json();if(!validId(teamId)||typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))return NextResponse.json({error:'Invalid invitation.'},{status:400});
    const db=adminDb(),ref=db.collection('teams').doc(teamId);
    const ok=await db.runTransaction(async tx=>{const team=await tx.get(ref);if(!team.exists||team.get('recoveryInviteHash')!==digest(token)||team.get('recoveryInviteEmail')!==user.email!.toLowerCase()||team.get('recoveryInviteExpiresAt')<=Date.now())return false;const old=team.get('recoveryContactUid');if(validId(old)&&old!==user.uid)tx.delete(db.collection('instructors').doc(old).collection('recoveryTeams').doc(teamId));tx.update(ref,{recoveryContactUid:user.uid,recoveryContactEmail:user.email!.toLowerCase(),recoveryInviteHash:FieldValue.delete(),recoveryInviteEmail:FieldValue.delete(),recoveryInviteExpiresAt:FieldValue.delete()});tx.set(db.collection('instructors').doc(user.uid).collection('recoveryTeams').doc(teamId),{active:true});tx.create(ref.collection('ownershipEvents').doc(),{action:'accepted recovery contact',actor:user.email,target:user.email,createdAt:FieldValue.serverTimestamp()});return true;});
    return ok?NextResponse.json({teamId},noStore):NextResponse.json({error:'Invitation is invalid, expired, used, or for another email.'},{status:400});
  }catch{return NextResponse.json({error:'Could not accept recovery invitation.'},{status:500});}
}

export async function PATCH(req:NextRequest) {
  try {
    const user=await instructorIdentity(req);if(!user)return NextResponse.json({error:'Sign in required.'},{status:401});if(!recent(user.auth_time))return NextResponse.json({error:'Please sign in again.'},{status:403});
    const {teamId}=await req.json();if(!validId(teamId))return NextResponse.json({error:'Invalid team.'},{status:400});
    const db=adminDb(),ref=db.collection('teams').doc(teamId);
    const ok=await db.runTransaction(async tx=>{const [team,member]=await Promise.all([tx.get(ref),tx.get(ref.collection('members').doc(user.uid))]);if(!team.exists||team.get('recoveryContactUid')!==user.uid||member.get('role')==='owner')return false;tx.set(ref.collection('members').doc(user.uid),{role:'owner',email:user.email!.toLowerCase(),createdAt:FieldValue.serverTimestamp()});tx.set(db.collection('instructors').doc(user.uid).collection('teamMemberships').doc(teamId),{role:'owner'});tx.update(ref,{ownershipUpdatedAt:FieldValue.serverTimestamp()});tx.create(ref.collection('ownershipEvents').doc(),{action:'recovered ownership',actor:user.email,target:user.email,createdAt:FieldValue.serverTimestamp()});return true;});
    return ok?NextResponse.json({teamId},noStore):unauthorized();
  }catch{return NextResponse.json({error:'Could not recover ownership.'},{status:500});}
}

export async function DELETE(req:NextRequest) {
  try {
    const user=await instructorIdentity(req);if(!user)return NextResponse.json({error:'Sign in required.'},{status:401});if(!recent(user.auth_time))return NextResponse.json({error:'Please sign in again.'},{status:403});
    const {teamId,kind}=await req.json();if(!validId(teamId)||!['contact','invitation'].includes(kind))return NextResponse.json({error:'Invalid request.'},{status:400});
    const db=adminDb(),ref=db.collection('teams').doc(teamId);
    const ok=await db.runTransaction(async tx=>{const [team,owner]=await Promise.all([tx.get(ref),tx.get(ref.collection('members').doc(user.uid))]);if(!team.exists||owner.get('role')!=='owner')return false;if(kind==='contact'){const old=team.get('recoveryContactUid');if(validId(old))tx.delete(db.collection('instructors').doc(old).collection('recoveryTeams').doc(teamId));tx.update(ref,{recoveryContactUid:FieldValue.delete(),recoveryContactEmail:FieldValue.delete()});}else tx.update(ref,{recoveryInviteHash:FieldValue.delete(),recoveryInviteEmail:FieldValue.delete(),recoveryInviteExpiresAt:FieldValue.delete()});tx.create(ref.collection('ownershipEvents').doc(),{action:kind==='contact'?'removed recovery contact':'revoked recovery invitation',actor:user.email,target:(kind==='contact'?team.get('recoveryContactEmail'):team.get('recoveryInviteEmail'))||'',createdAt:FieldValue.serverTimestamp()});return true;});
    return ok?NextResponse.json({ok:true}):unauthorized();
  }catch{return NextResponse.json({error:'Could not update recovery contact.'},{status:500});}
}
