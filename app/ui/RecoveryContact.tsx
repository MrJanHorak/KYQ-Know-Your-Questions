'use client';
import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { useInteraction } from './InteractionProvider';

export default function RecoveryContact({teamId,user}:{teamId:string;user:User}) {
  const {confirm,reauthenticate}=useInteraction();
  const [contact,setContact]=useState<string|null>(null),[pending,setPending]=useState<string|null>(null),[email,setEmail]=useState(''),[link,setLink]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const load=useCallback(async()=>{const res=await fetch(`/api/instructor/recovery?teamId=${encodeURIComponent(teamId)}`,{headers:{Authorization:`Bearer ${await user.getIdToken()}`},cache:'no-store'});if(!res.ok)throw new Error('Could not load recovery contact.');const data=await res.json();setContact(data.contact);setPending(data.pending);},[teamId,user]);
  useEffect(()=>{void load().catch(error=>setMessage(error.message));},[load]);
  async function change(method:string,body:object){setBusy(true);setMessage('');try{if(!await reauthenticate(user))return;const res=await fetch('/api/instructor/recovery',{method,headers:{Authorization:`Bearer ${await user.getIdToken()}`,'Content-Type':'application/json'},body:JSON.stringify({teamId,...body})});const data=await res.json();if(!res.ok)throw new Error(data.error);if(data.token){setLink(`${location.origin}/instructor?recoveryTeam=${encodeURIComponent(teamId)}&recoveryInvite=${encodeURIComponent(data.token)}`);setEmail('');}await load();}catch(error){setMessage(error instanceof Error?error.message:'Could not update recovery contact.');}finally{setBusy(false);}}
  return <div><h3>Recovery contact</h3><p>A trusted recovery contact can grant themselves full team ownership at any time, including access to every board. Choose someone who can securely protect their account. They have no team access until they use recovery.</p>
    <p>{contact?`Current contact: ${contact}`:'No recovery contact is configured.'}</p>
    {contact&&<button className='outline' disabled={busy} onClick={()=>void (async()=>{if(await confirm({title:'Remove recovery contact?',message:'This person will no longer be able to recover team ownership.',confirmLabel:'Remove',danger:true}))await change('DELETE',{kind:'contact'});})()}>Remove recovery contact</button>}
    {pending&&<p>Invitation pending for {pending}. <button className='outline' disabled={busy} onClick={()=>void change('DELETE',{kind:'invitation'})}>Revoke</button></p>}
    <form onSubmit={e=>{e.preventDefault();void change('POST',{email});}}><label>RECOVERY CONTACT EMAIL<input type='email' required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label><button className='outline' disabled={busy}>Create recovery invitation</button></form>
    {link&&<p>Share this one-time link directly. It expires in seven days. An existing contact remains active until the new contact accepts.<input aria-label='Recovery invitation link' readOnly value={link} onFocus={e=>e.currentTarget.select()}/><button className='outline' onClick={()=>void navigator.clipboard.writeText(link).then(()=>setMessage('Invitation link copied.')).catch(()=>setMessage('Select and copy the link.'))}>Copy link</button></p>}{message&&<p role='status'>{message}</p>}
  </div>;
}
