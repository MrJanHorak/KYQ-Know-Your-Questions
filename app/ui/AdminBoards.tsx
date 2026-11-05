'use client';
import { useEffect, useState } from 'react';
import { Code2, LockKeyhole, Plus } from 'lucide-react';
type Item = {id:string;name:string};

function DeleteBoard({board, onDeleted}: {board:Item; onDeleted:()=>void}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (!confirm(`Permanently delete “${board.name}” and all of its questions and replies? This cannot be undone.`)) return;
    setDeleting(true); setError('');
    try {
      const response = await fetch(`/api/boards/${encodeURIComponent(board.id)}`, {method:'DELETE'});
      if (response.ok) { onDeleted(); return; }
      const result = await response.json();
      setError(response.status === 401 ? 'Your instructor session has expired. Sign in again.' : result.error || 'Could not delete the board.');
    } catch { setError('Could not delete the board. Please try again.'); } finally { setDeleting(false); }
  }
  return <div className='delete-board'><button type='button' className='outline delete-button' disabled={deleting} onClick={remove}>{deleting ? 'Deleting…' : 'Delete board'}</button>{error && <p role='alert'>{error}</p>}</div>;
}

function PasswordEditor({board}: {board:Item}) {
  const [open,setOpen] = useState(false);
  const [password,setPassword] = useState('');
  const [confirmPassword,setConfirmPassword] = useState('');
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  async function submit(e:React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {setMessage('The passwords do not match.');return;}
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/boards/password', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({boardId:board.id,password})});
      const result = await response.json();
      if (!response.ok) {setMessage(response.status === 401 ? 'Your instructor session has expired. Sign in again.' : result.error || 'Could not change password.');return;}
      setPassword('');setConfirmPassword('');setOpen(false);setMessage('Password updated. Share the new password with your group.');
    } catch {setMessage('Could not change password. Please try again.');} finally {setBusy(false);}
  }
  return <div className='password-editor'>
    <button type='button' className='outline' onClick={()=>{setOpen(!open);setPassword('');setConfirmPassword('');setMessage('');}}>{open ? 'Cancel' : 'Change password'}</button>
    {open && <form onSubmit={submit} className='password-form'><p>Changing the password requires everyone to unlock this board again.</p><label>NEW PASSWORD<input type='password' autoComplete='new-password' required minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label><label>CONFIRM PASSWORD<input type='password' autoComplete='new-password' required minLength={8} maxLength={128} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label><button className='primary' disabled={busy}>Update password</button></form>}
    {message && <p role='status'>{message}</p>}
  </div>;
}

export default function AdminBoards() {
  const [boards,setBoards] = useState<Item[] | null>(null); const [password,setPassword] = useState(''); const [name,setName] = useState(''); const [boardPassword,setBoardPassword] = useState(''); const [error,setError] = useState(''); const [busy,setBusy] = useState(false); const [copied,setCopied] = useState('');
  async function load() { const r=await fetch('/api/boards',{cache:'no-store'}); if(r.ok) setBoards((await r.json()).boards); else if(r.status===401) setBoards(null); else setError('Could not load boards. Check the server configuration.'); }
  useEffect(()=>{ void load(); },[]);
  async function login(e:React.FormEvent) { e.preventDefault(); setBusy(true); try {const r=await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})}); if(!r.ok) setError(r.status === 429 ? 'Too many attempts. Try again in 10 minutes.' : 'Incorrect password or admin is not configured.'); else {setPassword('');setError('');await load();}} catch {setError('Could not connect. Please try again.');} finally {setBusy(false);} }
  async function create(e:React.FormEvent) {e.preventDefault();setBusy(true);try {const r=await fetch('/api/boards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,password:boardPassword})}); if(!r.ok) {setError((await r.json()).error || 'Could not create board.');return;} setName('');setBoardPassword('');setError('');await load();} catch {setError('Could not create board.');} finally {setBusy(false);}}
  async function importLegacy(id:string) {if(!confirm('Copy existing questions into this board? Originals will remain in place.')) return; setBusy(true); try {const r=await fetch('/api/boards/import-legacy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({boardId:id})}); const data=await r.json(); if(!r.ok) setError(data.error || 'Import failed.'); else alert(`Imported ${data.added} questions; ${data.existing} were already imported.`);} catch {setError('Import failed.');} finally {setBusy(false);}}
  if(!boards) return <main className='login-wrap'><form className='login card' onSubmit={login}><div className='brand-mark'><Code2 size={21}/></div><span className='eyebrow'>INSTRUCTOR ACCESS</span><h1>Welcome back.</h1><p>Enter your instructor password to manage your boards.</p><label>Password<input type='password' value={password} onChange={e=>setPassword(e.target.value)} required autoComplete='current-password'/></label>{error && <p className='error' role='alert'>{error}</p>}<button className='primary' disabled={busy}><LockKeyhole size={16}/> Unlock dashboard</button><a href='/'>← Back to KYQ</a></form></main>;
  return <main className='admin-page'><a href='/' className='brand'><span className='brand-mark'><Code2 size={20}/></span> KYQ</a><div className='admin-heading'><span className='eyebrow'>INSTRUCTOR DASHBOARD</span><h1>Your boards<span className='period'>.</span></h1><p>Create a private space for each course or conversation.</p></div>{error && <div className='notice error' role='alert'>{error}</div>}<div className='admin-grid'><section><h2>All boards</h2>{boards.length===0 ? <div className='empty'>No boards yet. Create your first one.</div> : boards.map(board=><article className='admin-board' key={board.id}><div><h3>{board.name}</h3><p>Private board · Share its link and password with your group</p></div><div className='admin-actions'><a className='outline' href={`/admin/boards/${board.id}`}>Manage board</a><button onClick={async()=>{try {await navigator.clipboard.writeText(`${location.origin}/boards/${board.id}`);setCopied(board.id);} catch {setError('Could not copy the link. Open the board and copy its URL.');}}}>{copied===board.id?'Link copied':'Copy link'}</button><a className='outline' href={`/api/boards/export?boardId=${board.id}&format=md`}>↓ Markdown</a><a className='outline' href={`/api/boards/export?boardId=${board.id}&format=json`}>↓ JSON</a><button type='button' disabled={busy} onClick={()=>importLegacy(board.id)}>Import old questions</button></div><PasswordEditor board={board}/><DeleteBoard board={board} onDeleted={()=>setBoards(current=>current?.filter(item=>item.id!==board.id) ?? null)}/></article>)}</section><form className='ask-card' onSubmit={create}><div className='ask-icon'><Plus size={22}/></div><span className='eyebrow'>NEW SPACE</span><h2>Create a board<span className='period'>.</span></h2><p>Give your group a name and a shared password.</p><label>BOARD NAME<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder='e.g. Coding Intensive'/></label><label>BOARD PASSWORD<input type='password' required minLength={8} maxLength={128} autoComplete='new-password' value={boardPassword} onChange={e=>setBoardPassword(e.target.value)} placeholder='At least 8 characters'/></label><button className='primary' disabled={busy}>Create private board <Plus size={16}/></button></form></div></main>;
}
