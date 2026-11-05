'use client';
import { useEffect, useRef, useState } from 'react';
import { Code2, LockKeyhole, Plus, Share2, Download, Settings2, ArrowUpRight } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import Dialog from './Dialog';
type Item = {id:string;name:string};

function DeleteBoard({board, onDeleted}: {board:Item; onDeleted:()=>void}) {
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    setDeleting(true); setError('');
    try {
      const response = await fetch(`/api/boards/${encodeURIComponent(board.id)}`, {method:'DELETE'});
      if (response.ok) { onDeleted(); return; }
      const result = await response.json();
      setError(response.status === 401 ? 'Your instructor session has expired. Sign in again.' : result.error || 'Could not delete the board.');
    } catch { setError('Could not delete the board. Please try again.'); } finally { setDeleting(false); }
  }
  return <div className='delete-board'><button type='button' className='outline delete-button' disabled={deleting} onClick={()=>setConfirming(true)}>{deleting ? 'Deleting…' : 'Delete board'}</button>{error && <p role='alert'>{error}</p>}{confirming && <Dialog title='Delete board?' onClose={()=>!deleting && setConfirming(false)}><p>Permanently delete “{board.name}” and all of its questions and replies? This cannot be undone.</p>{error && <p className='error' role='alert'>{error}</p>}<div className='dialog-actions'><button className='outline' disabled={deleting} onClick={()=>setConfirming(false)}>Cancel</button><button className='primary danger' disabled={deleting} onClick={remove}>{deleting ? 'Deleting…' : 'Delete board'}</button></div></Dialog>}</div>;
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

function ShareBoard({ board, onClose }: { board: Item; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [message, setMessage] = useState('');
  const url = `${window.location.origin}/boards/${encodeURIComponent(board.id)}`;
  async function copy() {
    try { await navigator.clipboard.writeText(url); setMessage('Link copied.'); }
    catch { setMessage('Could not copy the link. Select and copy it below.'); }
  }
  function download() {
    if (!canvas.current) return;
    const link = document.createElement('a');
    link.href = canvas.current.toDataURL('image/png');
    link.download = `kyq-board-${board.id}-qr.png`;
    link.click();
  }
  return <Dialog title='Share board' onClose={onClose}>
    <p>Share this link or QR code for “{board.name}”. Participants will also need the board password.</p>
    <div className='share-qr'><QRCodeCanvas ref={canvas} value={url} size={240} marginSize={4} aria-label={`QR code for ${board.name}`} /></div>
    <label>BOARD LINK<input readOnly value={url} onFocus={e => e.currentTarget.select()} /></label>
    {message && <p role='status'>{message}</p>}
    <div className='share-actions'><button className='outline' type='button' onClick={copy}>Copy link</button><button className='outline' type='button' onClick={download}>Download QR code</button></div>
  </Dialog>;
}

export default function AdminBoards() {
  const [boards,setBoards] = useState<Item[] | null>(null); const [password,setPassword] = useState(''); const [name,setName] = useState(''); const [boardPassword,setBoardPassword] = useState(''); const [error,setError] = useState(''); const [busy,setBusy] = useState(false);
  const [dialog,setDialog] = useState<{type:'share'|'export'|'settings'; board:Item} | null>(null);
  async function load() { const r=await fetch('/api/boards',{cache:'no-store'}); if(r.ok) setBoards((await r.json()).boards); else if(r.status===401) setBoards(null); else setError('Could not load boards. Check the server configuration.'); }
  useEffect(()=>{ void load(); },[]);
  async function login(e:React.FormEvent) { e.preventDefault(); setBusy(true); try {const r=await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})}); if(!r.ok) setError(r.status === 429 ? 'Too many attempts. Try again in 10 minutes.' : 'Incorrect password or admin is not configured.'); else {setPassword('');setError('');await load();}} catch {setError('Could not connect. Please try again.');} finally {setBusy(false);} }
  async function create(e:React.FormEvent) {e.preventDefault();setBusy(true);try {const r=await fetch('/api/boards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,password:boardPassword})}); if(!r.ok) {setError((await r.json()).error || 'Could not create board.');return;} setName('');setBoardPassword('');setError('');await load();} catch {setError('Could not create board.');} finally {setBusy(false);}}
  if(!boards) return <main className='login-wrap'><form className='login card' onSubmit={login}><div className='brand-mark'><Code2 size={21}/></div><span className='eyebrow'>INSTRUCTOR ACCESS</span><h1>Welcome back.</h1><p>Enter your instructor password to manage your boards.</p><label>Password<input type='password' value={password} onChange={e=>setPassword(e.target.value)} required autoComplete='current-password'/></label>{error && <p className='error' role='alert'>{error}</p>}<button className='primary' disabled={busy}><LockKeyhole size={16}/> Unlock dashboard</button><a href='/'>← Back to KYQ</a></form></main>;
  return <main className='admin-page'>
    <a href='/' className='brand'><span className='brand-mark'><Code2 size={20}/></span> KYQ</a>
    <div className='admin-heading'><span className='eyebrow'>INSTRUCTOR DASHBOARD</span><h1>Your boards<span className='period'>.</span></h1><p>Create a private space for each course or conversation.</p></div>
    {error && <div className='notice error' role='alert'>{error}</div>}
    {dialog?.type === 'share' && <ShareBoard board={dialog.board} onClose={()=>setDialog(null)} />}
    {dialog?.type === 'export' && <Dialog title='Export board' onClose={()=>setDialog(null)}><p>Download questions and replies from “{dialog.board.name}”.</p><div className='export-options'><a className='outline' href={`/api/boards/export?boardId=${encodeURIComponent(dialog.board.id)}&format=md`}>Download Markdown</a><a className='outline' href={`/api/boards/export?boardId=${encodeURIComponent(dialog.board.id)}&format=json`}>Download JSON</a></div></Dialog>}
    {dialog?.type === 'settings' && <Dialog title='Board settings' onClose={()=>setDialog(null)}><p>Manage access to “{dialog.board.name}”.</p><PasswordEditor board={dialog.board}/><div className='settings-danger'><strong>Delete this board</strong><p>Permanently remove the board, questions, and replies.</p><DeleteBoard board={dialog.board} onDeleted={()=>{setBoards(current=>current?.filter(item=>item.id!==dialog.board.id) ?? null);setDialog(null);}}/></div></Dialog>}
    <div className='admin-grid'><section><h2>All boards</h2>
      {boards.length===0 ? <div className='empty'>No boards yet. Create your first one.</div> : boards.map(board=><article className='admin-board' key={board.id}>
        <div><h3>{board.name}</h3><p>Private board · Share its link and password with your group</p></div>
        <div className='board-controls'>
          <a className='board-control board-manage' href={`/admin/boards/${encodeURIComponent(board.id)}`}>Manage <ArrowUpRight size={15}/></a>
          <button className='board-control' type='button' onClick={()=>setDialog({type:'share',board})}><Share2 size={15}/> Share</button>
          <button className='board-control' type='button' onClick={()=>setDialog({type:'export',board})}><Download size={15}/> Export</button>
          <button className='board-control' type='button' onClick={()=>setDialog({type:'settings',board})}><Settings2 size={15}/> Settings</button>
        </div>
      </article>)}
    </section><form className='ask-card' onSubmit={create}><div className='ask-icon'><Plus size={22}/></div><span className='eyebrow'>NEW SPACE</span><h2>Create a board<span className='period'>.</span></h2><p>Give your group a name and a shared password.</p><label>BOARD NAME<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder='e.g. Coding Intensive'/></label><label>BOARD PASSWORD<input type='password' required minLength={8} maxLength={128} autoComplete='new-password' value={boardPassword} onChange={e=>setBoardPassword(e.target.value)} placeholder='At least 8 characters'/></label><button className='primary' disabled={busy}>Create private board <Plus size={16}/></button></form></div>
  </main>;
}
