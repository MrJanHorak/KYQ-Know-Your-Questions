'use client';
import { useCallback, useEffect, useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, type User } from 'firebase/auth';

export async function confirmOwnershipIdentity(user:User) {
  const password=window.prompt('Confirm your password to change team ownership:');
  if (!password || !user.email) throw new Error('Password confirmation cancelled.');
  await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,password));
  await user.getIdToken(true);
}

type Data={members:{uid:string;email:string}[];invitations:{id:string;email:string}[];events:{id:string;action:string;actor:string;target:string}[]};
export default function TeamOwners({teamId,user,onRemoved}:{teamId:string;user:User;onRemoved:()=>void}) {
  const [data,setData]=useState<Data>({members:[],invitations:[],events:[]}),[email,setEmail]=useState(''),[link,setLink]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const load=useCallback(async()=>{const response=await fetch(`/api/instructor/owners?teamId=${encodeURIComponent(teamId)}`,{headers:{Authorization:`Bearer ${await user.getIdToken()}`},cache:'no-store'}); if(!response.ok) throw new Error('Could not load team owners.'); setData(await response.json());},[teamId,user]);
  useEffect(()=>{void load().catch(error=>setMessage(error.message));},[load]);
  async function change(method:string,body:object) {setBusy(true);setMessage('');try {await confirmOwnershipIdentity(user); const response=await fetch('/api/instructor/owners',{method,headers:{Authorization:`Bearer ${await user.getIdToken()}`,'Content-Type':'application/json'},body:JSON.stringify({teamId,...body})});const result=await response.json();if(!response.ok) throw new Error(result.error); if(result.token){setLink(`${location.origin}/instructor?ownerInvite=${encodeURIComponent(result.token)}`);setEmail('');} if('uid' in body && body.uid===user.uid) {onRemoved();return;} await load();}catch(error){setMessage(error instanceof Error ? error.message : 'Could not change ownership.');}finally{setBusy(false);}}
  return <div><p>Owners can manage every board, create boards and change team ownership. Invite at least one other trusted owner for recovery.</p>
    <form onSubmit={e=>{e.preventDefault();void change('POST',{email});}}><label>OWNER EMAIL<input type='email' maxLength={254} required value={email} onChange={e=>setEmail(e.target.value)}/></label><button className='primary' disabled={busy}>Create owner invitation</button></form>
    {link && <p>Share this one-time link with the invited person. It expires in seven days.<input aria-label='Owner invitation link' readOnly value={link} onFocus={e=>e.currentTarget.select()}/><button className='outline' onClick={()=>void navigator.clipboard.writeText(link).then(()=>setMessage('Invitation link copied.')).catch(()=>setMessage('Select and copy the link.'))}>Copy link</button></p>}
    <h3>Owners</h3>{data.members.map(member=><div key={member.uid}>{member.email || member.uid}{member.uid===user.uid?' (you)':''} <button className='outline' disabled={busy} onClick={()=>{if(window.confirm(`Remove ${member.email || member.uid} as a team owner?`)) void change('DELETE',{uid:member.uid});}}>Remove</button></div>)}
    {!!data.invitations.length && <><h3>Pending invitations</h3>{data.invitations.map(invite=><div key={invite.id}>{invite.email} <button className='outline' disabled={busy} onClick={()=>void change('DELETE',{invitationId:invite.id})}>Revoke</button></div>)}</>}
    {!!data.events.length && <><h3>Recent ownership activity</h3>{data.events.map(event=><p key={event.id}>{event.actor} {event.action}: {event.target}</p>)}</>}{message && <p role='status'>{message}</p>}
  </div>;
}
