'use client';
import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { ArrowUpRight, Download, Settings2, Share2 } from 'lucide-react';
import Dialog from './Dialog';
import ShareBoard from './ShareBoard';

type Board = {id:string; name:string; deleting?:boolean};
export default function InstructorBoards({user}: {user:User}) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [createMismatch, setCreateMismatch] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<{type:'share'|'export'|'settings'|'retry'; board:Board} | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changeMismatch, setChangeMismatch] = useState(false);
  const request = useCallback(async (url:string, options:RequestInit = {}) => {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
    return fetch(url, {...options, headers});
  }, [user]);
  const load = useCallback(async (after?:string) => {
    const response = await request(`/api/instructor/boards${after ? `?after=${encodeURIComponent(after)}` : ''}`, {cache:'no-store'});
    if (!response.ok) throw new Error();
    const result = await response.json();
    setBoards(current => after ? [...current, ...result.boards] : result.boards);
    setNextCursor(result.nextCursor);
  }, [request]);
  useEffect(() => { void load().catch(() => setMessage('Could not load your boards.')); }, [load]);
  async function create(event:React.FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) { setCreateMismatch(true); return; }
    setCreateMismatch(false); setBusy(true); setMessage('');
    try {
      const response = await request('/api/instructor/boards', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name,password})});
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || 'Could not create the board.'); return; }
      setName(''); setPassword(''); setConfirmPassword(''); await load();
    } catch { setMessage('Could not create or reload the board.'); } finally { setBusy(false); }
  }
  async function download(board:Board, format:'md'|'json') {
    try {
      const response = await request(`/api/boards/export?boardId=${encodeURIComponent(board.id)}&format=${format}`);
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = `kyq-${board.id}.${format}`; link.click(); URL.revokeObjectURL(url);
    } catch { setDialogMessage('Could not export the board.'); }
  }
  async function remove(board:Board) {
    setBusy(true); setDialogMessage('');
    try { const response = await request(`/api/boards/${encodeURIComponent(board.id)}`, {method:'DELETE'}); if (!response.ok) throw new Error(); setConfirmDelete(false); setDialog(null); setBoards(current=>current.filter(item=>item.id!==board.id)); }
    catch { setDialogMessage('Could not delete the board. Please try again.'); await load().catch(() => {}); } finally { setBusy(false); }
  }
  async function changePassword(event:React.FormEvent, board:Board) {
    event.preventDefault();
    if (newPassword !== confirmNewPassword) { setChangeMismatch(true); return; }
    setChangeMismatch(false); setBusy(true); setDialogMessage('');
    try {
      const response = await request('/api/boards/password', {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({boardId:board.id,password:newPassword})});
      if (!response.ok) throw new Error();
      setPasswordOpen(false); setNewPassword(''); setConfirmNewPassword(''); setDialogMessage('Password changed. Participants must unlock the board again.');
    } catch { setDialogMessage('Could not change the board password.'); } finally { setBusy(false); }
  }
  function openDialog(type:'share'|'export'|'settings'|'retry', board:Board) {
    setDialogMessage(''); setPasswordOpen(false); setNewPassword(''); setConfirmNewPassword(''); setChangeMismatch(false); setDialog({type,board});
  }
  return <section className='instructor-boards'>
    {message && <p role='status'>{message}</p>}
    {dialog?.type === 'share' && <ShareBoard board={dialog.board} onClose={()=>setDialog(null)}/>}
    {dialog?.type === 'retry' && <Dialog title='Finish deleting board?' onClose={()=>{if (!busy) setDialog(null);}}><p>Deletion of “{dialog.board.name}” was interrupted. Finish permanently deleting the board and any remaining questions and replies.</p>{dialogMessage && <p role='alert'>{dialogMessage}</p>}<div className='dialog-actions'><button className='outline' disabled={busy} onClick={()=>setDialog(null)}>Cancel</button><button className='primary danger' disabled={busy} onClick={()=>void remove(dialog.board)}>{busy ? 'Deleting…' : 'Finish deletion'}</button></div></Dialog>}
    {dialog?.type === 'export' && <Dialog title='Export board' onClose={()=>setDialog(null)}><p>Download questions and replies from “{dialog.board.name}”.</p><div className='export-options'><button className='outline' type='button' onClick={()=>void download(dialog.board,'md')}>Download Markdown</button><button className='outline' type='button' onClick={()=>void download(dialog.board,'json')}>Download JSON</button></div>{dialogMessage && <p role='status'>{dialogMessage}</p>}</Dialog>}
    {dialog?.type === 'settings' && <Dialog title='Board settings' onClose={()=>{if (!busy) setDialog(null);}}><p>Manage access to “{dialog.board.name}”.</p>
      <div className='password-editor'><button type='button' className='outline' onClick={()=>{setPasswordOpen(!passwordOpen);setNewPassword('');setConfirmNewPassword('');setChangeMismatch(false);setDialogMessage('');}}>{passwordOpen ? 'Cancel' : 'Change password'}</button>
      {passwordOpen && <form className='password-form' onSubmit={event=>void changePassword(event,dialog.board)}><p>Participants will need to unlock this board again.</p><label>NEW PARTICIPANT PASSWORD<input type='password' autoComplete='new-password' required minLength={8} maxLength={128} value={newPassword} onChange={event=>{setNewPassword(event.target.value);setChangeMismatch(false);}}/></label><label>CONFIRM NEW PASSWORD<input type='password' autoComplete='new-password' required value={confirmNewPassword} aria-invalid={changeMismatch} aria-describedby={changeMismatch ? 'change-board-password-error' : undefined} onChange={event=>{setConfirmNewPassword(event.target.value);setChangeMismatch(false);}}/></label>{changeMismatch && <p id='change-board-password-error' className='board-password-error' role='alert'>Passwords do not match.</p>}<button className='primary' disabled={busy}>Update password</button></form>}</div>
      {dialogMessage && !confirmDelete && <p role='status'>{dialogMessage}</p>}
      <div className='settings-danger'><strong>Delete this board</strong><p>Permanently remove the board, questions, and replies.</p><div className='delete-board'><button className='outline delete-button' type='button' disabled={busy} onClick={()=>{setDialogMessage('');setConfirmDelete(true);}}>Delete board</button></div></div>
      {confirmDelete && <Dialog title='Delete board?' onClose={()=>{if(!busy)setConfirmDelete(false);}}><p>Permanently delete “{dialog.board.name}” and all of its questions and replies? This cannot be undone.</p>{dialogMessage && <p role='alert'>{dialogMessage}</p>}<div className='dialog-actions'><button className='outline' disabled={busy} onClick={()=>setConfirmDelete(false)}>Cancel</button><button className='primary danger' disabled={busy} onClick={()=>void remove(dialog.board)}>{busy ? 'Deleting…' : 'Delete board'}</button></div></Dialog>}
    </Dialog>}
    <div className='instructor-board-grid'><div className='instructor-board-list'>
    <h2>Your team boards</h2>
    <p>Share a board link and its password with your participants.</p>
    {boards.map(board => <article className='admin-board' key={board.id}>
      <h3>{board.name}</h3>
      <p>{board.deleting ? 'Deletion was interrupted. This board is unavailable until deletion is completed.' : 'Private board · Share its link and password with your group'}</p>
      <div className='board-controls'>
        {board.deleting ? <button type='button' className='board-control' onClick={()=>openDialog('retry',board)}>Finish deletion</button> : <>
        <a className='board-control board-manage' href={`/admin/boards/${encodeURIComponent(board.id)}`}>Manage <ArrowUpRight size={15}/></a>
        <button type='button' className='board-control' onClick={()=>openDialog('share',board)}><Share2 size={15}/> Share</button>
        <button type='button' className='board-control' onClick={()=>openDialog('export',board)}><Download size={15}/> Export</button>
        <button type='button' className='board-control' onClick={()=>openDialog('settings',board)}><Settings2 size={15}/> Settings</button>
        </>}
      </div>
    </article>)}
    {!boards.length && <div className='empty instructor-empty'><strong>No boards yet</strong><span>Create your first board to get started.</span></div>}
    {nextCursor && <button type='button' className='outline' onClick={()=>void load(nextCursor).catch(()=>setMessage('Could not load more boards.'))}>Load more boards</button>}
    </div>
    <form className='instructor-create-board' onSubmit={create}>
      <span className='eyebrow'>NEW SPACE</span><h3>Create a board<span className='period'>.</span></h3><p>Give your group a name and a shared password.</p>
      <label>BOARD NAME<input maxLength={100} required value={name} onChange={e=>setName(e.target.value)} placeholder='e.g. Coding Intensive'/></label>
      <label>PARTICIPANT PASSWORD<input type='password' autoComplete='new-password' minLength={8} maxLength={128} required value={password} onChange={e=>{setPassword(e.target.value);setCreateMismatch(false);}} placeholder='At least 8 characters'/></label>
      <label>CONFIRM PASSWORD<input type='password' autoComplete='new-password' required value={confirmPassword} aria-invalid={createMismatch} aria-describedby={createMismatch ? 'create-board-password-error' : undefined} onChange={e=>{setConfirmPassword(e.target.value);setCreateMismatch(false);}}/></label>
      {createMismatch && <p id='create-board-password-error' className='board-password-error' role='alert'>Passwords do not match.</p>}
      <button className='primary' disabled={busy}>Create board</button>
    </form>
    </div>
  </section>;
}
