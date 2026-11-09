'use client';
import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';

const roles = ['responder','moderator','manager','admin'] as const;
type Role = typeof roles[number];
type Member = {uid:string;email:string;role:Role};
type Invitation = {id:string;email:string;role:Role};
export default function BoardManagers({boardId,user}:{boardId:string;user:User}) {
  const [members,setMembers]=useState<Member[]>([]), [invitations,setInvitations]=useState<Invitation[]>([]);
  const [email,setEmail]=useState(''), [role,setRole]=useState<Role>('responder'), [link,setLink]=useState(''), [message,setMessage]=useState(''), [busy,setBusy]=useState(false);
  const request=useCallback(async (method:string,body?:object)=>fetch(`/api/instructor/managers${method==='GET' ? `?boardId=${encodeURIComponent(boardId)}` : ''}`,{method,headers:{Authorization:`Bearer ${await user.getIdToken()}`,'Content-Type':'application/json'},...(body ? {body:JSON.stringify({boardId,...body})} : {})}),[boardId,user]);
  const load=useCallback(async()=>{const response=await request('GET'); if(!response.ok) throw new Error(); const data=await response.json(); setMembers(data.members); setInvitations(data.invitations);},[request]);
  useEffect(()=>{void load().catch(()=>setMessage('Could not load managers.'));},[load]);
  async function change(method:string,body:object) {setBusy(true);setMessage('');try {const response=await request(method,body);const data=await response.json();if(!response.ok) throw new Error(data.error);if(data.token) {setLink(`${location.origin}/instructor?invite=${encodeURIComponent(data.token)}`);setEmail('');} await load();} catch(error) {setMessage(error instanceof Error ? error.message : 'Could not update access.');} finally {setBusy(false);}}
  return <div>
    <p>Roles are cumulative: responders answer and change status; moderators also delete posts and replies; managers also change passwords and export; admins also edit posts, manage access and delete the board.</p>
    <form onSubmit={e=>{e.preventDefault();void change('POST',{email,role});}}>
      <label>EMAIL<input type='email' required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <label>ROLE<select value={role} onChange={e=>setRole(e.target.value as Role)}>{roles.map(r=><option key={r} value={r}>{r}</option>)}</select></label>
      <button className='primary' disabled={busy}>Create invitation</button>
    </form>
    {link && <p>Share this one-time link with the invited person. It expires in seven days.<input readOnly aria-label='Invitation link' value={link} onFocus={e=>e.currentTarget.select()}/><button type='button' className='outline' onClick={()=>void navigator.clipboard.writeText(link).then(()=>setMessage('Invitation link copied.')).catch(()=>setMessage('Select and copy the invitation link.'))}>Copy link</button></p>}
    <h3>Managers</h3>
    {members.length ? members.map(member=><div key={member.uid}><span>{member.email || member.uid} </span><select aria-label={`Role for ${member.email || member.uid}`} value={member.role} disabled={busy} onChange={e=>void change('PATCH',{uid:member.uid,role:e.target.value})}>{roles.map(r=><option key={r} value={r}>{r}</option>)}</select><button className='outline' disabled={busy} onClick={()=>{if(window.confirm(`Remove ${member.email || member.uid} from this board?`)) void change('DELETE',{uid:member.uid});}}>Remove</button></div>) : <p>No managers yet.</p>}
    {!!invitations.length && <><h3>Pending invitations</h3>{invitations.map(invite=><div key={invite.id}>{invite.email} · {invite.role} <button className='outline' disabled={busy} onClick={()=>void change('DELETE',{invitationId:invite.id})}>Revoke</button></div>)}</>}
    {message && <p role='status'>{message}</p>}
  </div>;
}
