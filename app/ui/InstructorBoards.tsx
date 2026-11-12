'use client';
import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { ArrowUpRight, Download, Settings2, Share2 } from 'lucide-react';
import Dialog from './Dialog';
import ShareBoard from './ShareBoard';
import BoardManagers from './BoardManagers';
import TeamOwners from './TeamOwners';
import { useInteraction } from './InteractionProvider';

type Board = {id:string; name:string; deleting?:boolean};
type SharedBoard = Board & {role:'responder'|'moderator'|'manager'|'admin'};
export default function InstructorBoards({user}: {user:User}) {
  const {confirm,reauthenticate}=useInteraction();
  const [boards, setBoards] = useState<Board[]>([]);
  const [sharedBoards, setSharedBoards] = useState<SharedBoard[]>([]);
  const [invitation, setInvitation] = useState('');
  const [ownerInvitation,setOwnerInvitation]=useState('');
  const [recoveryInvitation,setRecoveryInvitation]=useState('');
  const [recoveryTeam,setRecoveryTeam]=useState('');
  const [recoveryTeams,setRecoveryTeams]=useState<{id:string}[]>([]);
  const [teams,setTeams]=useState<{id:string;personal:boolean}[]>([]);
  const [teamId,setTeamId]=useState('');
  const [ownersOpen,setOwnersOpen]=useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [createMismatch, setCreateMismatch] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<{type:'share'|'export'|'settings'|'retry'|'managers'; board:Board} | null>(null);
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
    if (!teamId) return;
    const params=new URLSearchParams({teamId}); if(after) params.set('after',after);
    const response = await request(`/api/instructor/boards?${params}`, {cache:'no-store'});
    if (!response.ok) throw new Error();
    const result = await response.json();
    setBoards(current => after ? [...current, ...result.boards] : result.boards);
    setNextCursor(result.nextCursor);
  }, [request,teamId]);
  const loadTeams=useCallback(async (preferred?:string)=>{const response=await request('/api/instructor/owners',{cache:'no-store'});if(!response.ok) throw new Error('Could not load teams.');const result=await response.json();setTeams(result.teams);setTeamId(current=>result.teams.some((team:{id:string})=>team.id===(preferred||current)) ? (preferred||current) : (result.teams[0]?.id || ''));},[request]);
  const loadRecovery=useCallback(async()=>{const response=await request('/api/instructor/recovery',{cache:'no-store'});if(!response.ok)throw new Error('Could not load recovery teams.');setRecoveryTeams((await response.json()).teams);},[request]);
  useEffect(()=>{void loadTeams().catch(()=>setMessage('Could not load teams.'));},[loadTeams]);
  useEffect(()=>{void loadRecovery().catch(()=>setMessage('Could not load recovery teams.'));},[loadRecovery]);
  const loadShared = useCallback(async () => { const response=await request('/api/instructor/shared-boards',{cache:'no-store'}); if (!response.ok) throw new Error(); setSharedBoards((await response.json()).boards); },[request]);
  useEffect(() => { void load().catch(() => setMessage('Could not load your boards.')); }, [load]);
  useEffect(() => { void loadShared().catch(() => setMessage('Could not load shared boards.')); const params=new URLSearchParams(window.location.search); setInvitation(params.get('invite') || '');setOwnerInvitation(params.get('ownerInvite') || '');setRecoveryInvitation(params.get('recoveryInvite') || '');setRecoveryTeam(params.get('recoveryTeam') || ''); }, [loadShared]);
  async function recovery(method:'PUT'|'PATCH',id:string){setBusy(true);setMessage('');try{if(!await reauthenticate(user))return;const response=await request('/api/instructor/recovery',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({teamId:id,...(method==='PUT'?{token:recoveryInvitation}:{})})});const result=await response.json();if(!response.ok)throw new Error(result.error);if(method==='PUT'){setRecoveryInvitation('');const url=new URL(location.href);url.searchParams.delete('recoveryInvite');url.searchParams.delete('recoveryTeam');history.replaceState(null,'',url);await loadRecovery();setMessage('Recovery contact invitation accepted.');}else{await loadTeams(id);setMessage('Team ownership recovered.');}}catch(error){setMessage(error instanceof Error?error.message:'Could not update recovery access.');}finally{setBusy(false);}}
  async function acceptOwnerInvitation(){setBusy(true);setMessage('');try{if(!await reauthenticate(user))return;const response=await request('/api/instructor/owners',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:ownerInvitation})});const result=await response.json();if(!response.ok)throw new Error(result.error);setOwnerInvitation('');const url=new URL(location.href);url.searchParams.delete('ownerInvite');history.replaceState(null,'',url);await loadTeams(result.teamId);setMessage('Team ownership accepted.');}catch(error){setMessage(error instanceof Error?error.message:'Could not accept invitation.');}finally{setBusy(false);}}
  async function acceptInvitation() { setBusy(true); setMessage(''); try { const response=await request('/api/instructor/managers',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:invitation})}); const result=await response.json(); if (!response.ok) throw new Error(result.error); setInvitation(''); const url=new URL(window.location.href); url.searchParams.delete('invite'); window.history.replaceState(null,'',url); await loadShared(); setMessage('Invitation accepted.'); } catch(error) {setMessage(error instanceof Error ? error.message : 'Could not accept invitation.');} finally {setBusy(false);} }
  async function create(event:React.FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) { setCreateMismatch(true); return; }
    setCreateMismatch(false); setBusy(true); setMessage('');
    try {
      const response = await request('/api/instructor/boards', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name,password,teamId})});
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
    try { const response = await request(`/api/boards/${encodeURIComponent(board.id)}`, {method:'DELETE'}); if (!response.ok) throw new Error(); setConfirmDelete(false); setDialog(null); setBoards(current=>current.filter(item=>item.id!==board.id)); setSharedBoards(current=>current.filter(item=>item.id!==board.id)); }
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
  function openDialog(type:'share'|'export'|'settings'|'retry'|'managers', board:Board) {
    setDialogMessage(''); setPasswordOpen(false); setNewPassword(''); setConfirmNewPassword(''); setChangeMismatch(false); setDialog({type,board});
  }
  return <section className='instructor-boards'>
    {message && <p role='status'>{message}</p>}
    {recoveryInvitation && <div><p>You are invited to be a recovery contact. You can grant yourself full ownership of the team and access to all its boards.</p><button className='primary' disabled={busy} onClick={()=>void recovery('PUT',recoveryTeam)}>Accept recovery contact role</button></div>}
    {recoveryTeams.filter(team=>!teams.some(owned=>owned.id===team.id)).map(team=><div key={team.id}><p>Recovery contact for team {team.id}.</p><button className='outline' disabled={busy} onClick={()=>void (async()=>{if(await confirm({title:'Recover team ownership?',message:'You will become an owner with full access to all its boards.',confirmLabel:'Recover ownership'}))await recovery('PATCH',team.id);})()}>Recover team ownership</button></div>)}
    {ownerInvitation && <div><p>You have an invitation to become a team owner. Owners can manage all team boards and ownership.</p><button className='primary' disabled={busy} onClick={()=>void acceptOwnerInvitation()}>Accept team ownership</button></div>}
    {teams.length>0 && <div><label>TEAM<select value={teamId} onChange={e=>{setBoards([]);setTeamId(e.target.value);}}>{teams.map(team=><option key={team.id} value={team.id}>{team.personal?'Your personal team':`Shared team ${team.id}`}</option>)}</select></label><button className='outline' onClick={()=>setOwnersOpen(true)}>Team owners</button></div>}
    {ownersOpen && teamId && <Dialog title='Team owners' onClose={()=>setOwnersOpen(false)}><TeamOwners teamId={teamId} user={user} onRemoved={()=>{setOwnersOpen(false);setBoards([]);void loadTeams().catch(()=>setMessage('Could not load teams.'));}}/></Dialog>}
    {invitation && <div><p>You have a board invitation. Sign in with the email address it was sent to.</p><button className='primary' disabled={busy} onClick={()=>void acceptInvitation()}>Accept invitation</button></div>}
    {dialog?.type === 'managers' && <Dialog title='Board managers' onClose={()=>setDialog(null)}><BoardManagers boardId={dialog.board.id} user={user}/></Dialog>}
    {dialog?.type === 'share' && <ShareBoard board={dialog.board} onClose={()=>setDialog(null)}/>}
    {dialog?.type === 'retry' && <Dialog title='Finish deleting board?' onClose={()=>{if (!busy) setDialog(null);}}><p>Deletion of “{dialog.board.name}” was interrupted. Finish permanently deleting the board and any remaining questions and replies.</p>{dialogMessage && <p role='alert'>{dialogMessage}</p>}<div className='dialog-actions'><button className='outline' disabled={busy} onClick={()=>setDialog(null)}>Cancel</button><button className='primary danger' disabled={busy} onClick={()=>void remove(dialog.board)}>{busy ? 'Deleting…' : 'Finish deletion'}</button></div></Dialog>}
    {dialog?.type === 'export' && <Dialog title='Export board' onClose={()=>setDialog(null)}><p>Download questions and replies from “{dialog.board.name}”.</p><div className='export-options'><button className='outline' type='button' onClick={()=>void download(dialog.board,'md')}>Download Markdown</button><button className='outline' type='button' onClick={()=>void download(dialog.board,'json')}>Download JSON</button></div>{dialogMessage && <p role='status'>{dialogMessage}</p>}</Dialog>}
    {dialog?.type === 'settings' && <Dialog title='Board settings' onClose={()=>{if (!busy) setDialog(null);}}><p>Manage access to “{dialog.board.name}”.</p>
      <div className='password-editor'><button type='button' className='outline' onClick={()=>{setPasswordOpen(!passwordOpen);setNewPassword('');setConfirmNewPassword('');setChangeMismatch(false);setDialogMessage('');}}>{passwordOpen ? 'Cancel' : 'Change password'}</button>
      {passwordOpen && <form className='password-form' onSubmit={event=>void changePassword(event,dialog.board)}><p>Participants will need to unlock this board again.</p><label>NEW PARTICIPANT PASSWORD<input type='password' autoComplete='new-password' required minLength={8} maxLength={128} value={newPassword} onChange={event=>{setNewPassword(event.target.value);setChangeMismatch(false);}}/></label><label>CONFIRM NEW PASSWORD<input type='password' autoComplete='new-password' required value={confirmNewPassword} aria-invalid={changeMismatch} aria-describedby={changeMismatch ? 'change-board-password-error' : undefined} onChange={event=>{setConfirmNewPassword(event.target.value);setChangeMismatch(false);}}/></label>{changeMismatch && <p id='change-board-password-error' className='board-password-error' role='alert'>Passwords do not match.</p>}<button className='primary' disabled={busy}>Update password</button></form>}</div>
      {dialogMessage && !confirmDelete && <p role='status'>{dialogMessage}</p>}
      {(!sharedBoards.some(item=>item.id===dialog.board.id) || sharedBoards.some(item=>item.id===dialog.board.id && item.role==='admin')) && <div className='settings-danger'><strong>Delete this board</strong><p>Permanently remove the board, questions, and replies.</p><div className='delete-board'><button className='outline delete-button' type='button' disabled={busy} onClick={()=>{setDialogMessage('');setConfirmDelete(true);}}>Delete board</button></div></div>}
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
        <button type='button' className='board-control' onClick={()=>openDialog('managers',board)}>Managers</button>
        </>}
      </div>
    </article>)}
    {!boards.length && <div className='empty instructor-empty'><strong>No boards yet</strong><span>Create your first board to get started.</span></div>}
    {nextCursor && <button type='button' className='outline' onClick={()=>void load(nextCursor).catch(()=>setMessage('Could not load more boards.'))}>Load more boards</button>}
    {!!sharedBoards.length && <><h2>Shared with you</h2>{sharedBoards.map(board=><article className='admin-board' key={board.id}><h3>{board.name}</h3><p>{board.role} {board.deleting ? '· Deletion interrupted' : ''}</p><div className='board-controls'>{!board.deleting && <a className='board-control board-manage' href={`/admin/boards/${encodeURIComponent(board.id)}`}>Manage <ArrowUpRight size={15}/></a>}{['manager','admin'].includes(board.role) && !board.deleting && <><button className='board-control' onClick={()=>openDialog('export',board)}>Export</button><button className='board-control' onClick={()=>openDialog('settings',board)}>Settings</button></>}{board.role==='admin' && <button className='board-control' onClick={()=>openDialog('managers',board)}>Managers</button>}{board.role==='admin' && board.deleting && <button className='board-control' onClick={()=>openDialog('retry',board)}>Finish deletion</button>}</div></article>)}</>}
    </div>
    <form className='instructor-create-board' onSubmit={create}>
      <span className='eyebrow'>NEW SPACE</span><h3>Create a board<span className='period'>.</span></h3><p>Give your group a name and a shared password.</p>
      <label>BOARD NAME<input maxLength={100} required value={name} onChange={e=>setName(e.target.value)} placeholder='e.g. Coding Intensive'/></label>
      <label>PARTICIPANT PASSWORD<input type='password' autoComplete='new-password' minLength={8} maxLength={128} required value={password} onChange={e=>{setPassword(e.target.value);setCreateMismatch(false);}} placeholder='At least 8 characters'/></label>
      <label>CONFIRM PASSWORD<input type='password' autoComplete='new-password' required value={confirmPassword} aria-invalid={createMismatch} aria-describedby={createMismatch ? 'create-board-password-error' : undefined} onChange={e=>{setConfirmPassword(e.target.value);setCreateMismatch(false);}}/></label>
      {createMismatch && <p id='create-board-password-error' className='board-password-error' role='alert'>Passwords do not match.</p>}
      <button className='primary' disabled={busy || !teamId}>Create board</button>
    </form>
    </div>
  </section>;
}
