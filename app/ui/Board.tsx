'use client';
import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInAnonymously, signInWithCustomToken, signOut } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Code2,
  Flame,
  Link2,
  LockKeyhole,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { auth, configured, db } from '../../lib/firebase';
import type { Question, Status } from '../../lib/types';
import Dialog from './Dialog';
import ReplyEditor from './ReplyEditor';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const labels: Record<Status, string> = {
  unanswered: 'OPEN',
  in_review: 'IN REVIEW',
  answered: 'ANSWERED',
};
const timeAgo = (seconds?: number) => {
  if (!seconds) return 'just now';
  const m = Math.max(0, Math.floor((Date.now() - seconds * 1000) / 60000));
  return m < 1
    ? 'just now'
    : m < 60
      ? `${m}m ago`
      : m < 1440
        ? `${Math.floor(m / 60)}h ago`
        : `${Math.floor(m / 1440)}d ago`;
};
const avatarColors = [
  ['#e3f2d5', '#355e2b'], ['#e0edfa', '#28547d'], ['#f8e5d7', '#824b28'],
  ['#f3e2ed', '#7e3d66'], ['#e8e4fa', '#514386'], ['#f7ebc9', '#765711'],
  ['#d8f1ea', '#28685b'], ['#f7dddd', '#8a4141'], ['#e0ebd1', '#536326'],
  ['#dcebf1', '#3a6171'], ['#f1e1d8', '#79503e'], ['#e7e3ef', '#625176'],
];
const avatarSymbols = ['✦', '●', '◆', '✿', '▲', '✱', '♥', '■'];
function Avatar({ name, authorUid }: { name: string; authorUid?: string }) {
  if (!authorUid) return <span className='avatar' aria-hidden='true'>{(name || 'A')[0].toUpperCase()}</span>;
  let hash = 2166136261;
  for (const character of authorUid) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const value = hash >>> 0;
  const [background, color] = avatarColors[value % avatarColors.length];
  const content = !name || name.toLowerCase() === 'anonymous' ? avatarSymbols[Math.floor(value / avatarColors.length) % avatarSymbols.length] : name[0].toUpperCase();
  return <span className='avatar' aria-hidden='true' style={{ background, color }}>{content}<img src={`https://api.dicebear.com/10.x/clay/svg?seed=${value}`} alt='' referrerPolicy='no-referrer' onError={e => { e.currentTarget.style.display = 'none'; }} /></span>;
}
function Reference({ value, iconSize }: { value: string; iconSize: number }) {
  const candidate = value.trim();
  let href: string | null = null;
  if (!/\s/.test(candidate) && /^(https?:\/\/|www\.)/i.test(candidate)) {
    try {
      const url = new URL(/^www\./i.test(candidate) ? 'https://' + candidate : candidate);
      if ((url.protocol === 'http:' || url.protocol === 'https:') && url.hostname) href = url.href;
    } catch { /* Keep non-URL lesson references as text. */ }
  }
  return <div className='reference'><Link2 size={iconSize} /> {href ? <a href={href} target='_blank' rel='noopener noreferrer'>{value}</a> : value}</div>;
}
export default function Board({ admin = false, boardId }: { admin?: boolean; boardId: string }) {
  const [uid, setUid] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'Hot' | 'New' | 'FAQ'>('Hot');
  const [question, setQuestion] = useState('');
  const [reference, setReference] = useState('');
  const [name, setName] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [replyName, setReplyName] = useState('');
  const [editingReply, setEditingReply] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replyError, setReplyError] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [boardName, setBoardName] = useState('The question board');
  const [password, setPassword] = useState('');
  const [presenter, setPresenter] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editReference, setEditReference] = useState('');
  const [deleting, setDeleting] = useState<Question | null>(null);
  const [dialogError, setDialogError] = useState('');
  useEffect(() => {
    if (!auth) return;
    const a = auth;
    return onAuthStateChanged(a, async (user) => {
      if (user) {
        setUid(user.uid);
        try { const claims = await user.getIdTokenResult(); setUnlocked(claims.claims.boardId === boardId); if (claims.claims.boardId === boardId && typeof claims.claims.boardName === 'string') setBoardName(claims.claims.boardName); }
        catch { setError('Could not verify access. Refresh the page to try again.'); }
        setCheckingAccess(false);
      }
      else
        signInAnonymously(a).catch(() => {
          setLoading(false);
          setCheckingAccess(false);
          setError(
            'Could not connect to the board. Check your connection and Firebase configuration, then refresh the page.',
          );
        });
    });
  }, [boardId]);
  useEffect(() => { if (!auth) setCheckingAccess(false); }, []);
  useEffect(() => {
    if (!db || !uid || !unlocked) return;
    return onSnapshot(
      collection(db, 'boards', boardId, 'questions'),
      (snap) => {
        setQuestions(
          snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Question),
        );
        setLoading(false);
      },
      (failure) => {
        setLoading(false);
        if (failure.code === 'permission-denied') {
          setQuestions([]);
          setSelected(null);
          setUnlocked(false);
          setError(admin ? 'Board access changed. Reopen the board to continue.' : 'Board access changed. Enter the current board password to continue.');
          return;
        }
        setError(
          'Could not load questions. Check your Firestore configuration and rules.',
        );
      },
    );
  }, [uid, unlocked, boardId]);
  useEffect(() => {
    const end = Number(localStorage.getItem('kyq-cooldown') || 0);
    const tick = () =>
      setCooldown(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [busy]);
  const items = useMemo(
    () =>
      questions
        .filter((q) => filter !== 'FAQ' || q.status === 'answered')
        .sort((a, b) =>
          filter === 'Hot'
            ? b.upvoteCount - a.upvoteCount ||
              (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
            : (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
        ),
    [questions, filter],
  );
  const active = questions.find((q) => q.id === selected);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!db || !uid || !question.trim() || question.length > 2000 || cooldown || busy) return;
    setBusy(true);
    try {
      await addDoc(collection(db, 'boards', boardId, 'questions'), {
        question: question.trim(),
        lessonReference: reference.trim(),
        authorName: name.trim() || 'Anonymous',
        authorUid: uid,
        upvotes: [],
        upvoteCount: 0,
        status: 'unanswered',
        createdAt: serverTimestamp(),
        replies: [],
      });
      localStorage.setItem('kyq-cooldown', String(Date.now() + 15000));
      setQuestion('');
      setReference('');
      setName('');
    } catch {
      setError('Your question could not be posted. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function vote(q: Question) {
    if (!db || !uid || q.upvotes.includes(uid)) return;
    try {
      const ref = doc(db, 'boards', boardId, 'questions', q.id);
      await runTransaction(db, async (tx) => {
        const snapshot = await tx.get(ref);
        const data = snapshot.data();
        if (!data || data.upvotes.includes(uid)) return;
        tx.update(ref, {
          upvotes: [...data.upvotes, uid],
          upvoteCount: data.upvoteCount + 1,
        });
      });
    } catch {
      setError('Your upvote could not be saved. Please try again.');
    }
  }
  async function saveReply(edit = false) {
    if (!active || !auth?.currentUser || busy) return;
    const text = (edit ? replyDraft : reply).trim();
    if (!text || text.length > 2000 || (edit && !editingReply)) return;
    setBusy(true); setReplyError('');
    try {
      const response = await fetch('/api/replies', {
        method: edit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, questionId: active.id, replyId: editingReply, text, author: replyName.trim(), idToken: await auth.currentUser.getIdToken() }),
      });
      if (!response.ok) throw new Error();
      if (edit) { setEditingReply(null); setReplyDraft(''); }
      else { setReply(''); setReplyName(''); }
    } catch { setReplyError('Your reply could not be saved. Please try again.'); }
    finally { setBusy(false); }
  }
  function addReply(e: React.FormEvent) { e.preventDefault(); void saveReply(); }
  async function openBoard(instructor = false) {
    if (!auth?.currentUser) { setError('Could not connect. Refresh the page and try again.'); return; }
    setBusy(true);
    try {
    const r = await fetch('/api/boards/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardId, password, idToken: await auth.currentUser.getIdToken(), instructor }),
    });
    if (r.ok) {
      const data = await r.json();
      await signInWithCustomToken(auth, data.token);
      setBoardName(data.name);
      setUnlocked(true);
      setPassword('');
      setError('');
    } else setError(r.status === 429 ? 'Too many attempts. Try again in 10 minutes.' : r.status === 401 ? (instructor ? 'Please sign in to the instructor dashboard first.' : 'Incorrect board link or password.') : 'Could not open the board. Please try again.');
    } catch { setError('Could not connect to the board. Please try again.'); } finally { setBusy(false); }
  }
  useEffect(() => { if (admin && uid && !checkingAccess && !unlocked) void openBoard(true); }, [admin, uid, checkingAccess]);
  async function action(id: string, operation: string, value?: string, lessonReference?: string) {
    try {
      const r = await fetch('/api/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ boardId, id, operation, value, lessonReference }) });
      if (!r.ok) throw new Error();
      return true;
    } catch { setError('Admin action failed. Please try again.'); return false; }
  }
  function startEdit(q: Question) { setEditQuestion(q.question); setEditReference(q.lessonReference || ''); setDialogError(''); setEditing(q); }
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editQuestion.trim() || editQuestion.length > 2000 || !db) return;
    setBusy(true); setDialogError('');
    try {
      if (admin) { if (!await action(editing.id, 'edit', editQuestion.trim(), editReference.trim())) throw new Error(); }
      else await updateDoc(doc(db, 'boards', boardId, 'questions', editing.id), { question: editQuestion.trim(), lessonReference: editReference.trim() });
      setEditing(null);
    } catch { setDialogError('Could not save your changes. Please try again.'); }
    finally { setBusy(false); }
  }
  if (!unlocked || checkingAccess)
    return (
      <main className='login-wrap'>
        <form className='login card' onSubmit={e=>{e.preventDefault(); void openBoard(admin);}}>
          <div className='brand-mark'>
            <Code2 size={21} />
          </div>
          <span className='eyebrow'>PRIVATE BOARD</span>
          <h1>Welcome in<span className='period'>.</span></h1>
          <p>{admin ? 'Opening your instructor dashboard.' : 'Enter the shared board password to join the conversation.'}</p>
          {!admin && <>
          <label>
            Password
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder='Enter password'
            />
          </label>
          <button className='primary' type='submit' disabled={busy || checkingAccess || !uid}>
            <LockKeyhole size={16} /> Unlock board
          </button></>}
          {error && <p className='error' role='alert'>{error}</p>}
          {admin && <><button className='primary' type='button' disabled={busy || checkingAccess || !uid} onClick={()=>void openBoard(true)}>Open board</button><a href='/admin'>← Back to your boards</a></>}
        </form>
      </main>
    );
  return (
    <>
      <header className='topbar'>
        <div className='top-inner'>
          <a href='/' className='brand'>
            <span className='brand-mark'>
              <Code2 size={20} />
            </span>
            <span>
              KYQ <small> / KNOW YOUR QUESTIONS</small>
            </span>
          </a>
          <div className='top-right'>
            {admin ? <a className='outline' href='/admin'>Your boards</a> : <button className='outline' onClick={async()=>{ if (auth) {setUnlocked(false); setQuestions([]); await signOut(auth);} }}>Lock board</button>}
            <span className='live'>
              <i /> LIVE BOARD
            </span>
            <span className='course-pill'>
              THE QUESTION PORTAL <span>↗</span>
            </span>
          </div>
        </div>
      </header>
      <main className={presenter ? 'page presenter' : 'page'}>
        <section className='hero'>
          <div>
            <div className='eyebrow'>
              <span className='eyebrow-dot' /> YOUR COMMUNITY SPACE{' '}
              <span className='eyebrow-slash'></span>
            </div>
            <h1>
              Good questions
              <br />
              <em>drive great</em> outcomes<span className='period'>.</span>
            </h1>
            <p>
              Stuck on something? Curious about everything? This is your space
              to ask, learn, and build together.
            </p>
            <a href='#ask' className='hero-link'>
              ASK A QUESTION <ArrowDown size={14} />
            </a>
          </div>
          <div className='hero-art' aria-hidden='true'>
            <div className='orbit orbit-one' />
            <div className='orbit orbit-two' />
            <div className='art-star'>✳</div>
            <div className='art-card'>
              <div className='art-top'>
                <span>THE LEARNING LOOP</span>
                <Sparkles size={16} />
              </div>
              <div className='art-symbol'>?</div>
              <div className='art-bottom'>
                <span>
                  ASK MORE.
                  <br />
                  BUILD BETTER.
                </span>
                <span>↗</span>
              </div>
            </div>
            <span className='art-caption'>CURIOSITY IS A SUPERPOWER ✳</span>
          </div>
        </section>
        <div className='ticker'>
          <span>✳ &nbsp; ASK BOLDLY</span>
          <span>✳ &nbsp; LEARN TOGETHER</span>
          <span>✳ &nbsp; NO QUESTION TOO SMALL</span>
          <span>✳ &nbsp; KEEP BUILDING</span>
        </div>
        <div className='workspace'>
          <div className='main-column'>
            <div className='section-head'>
              <div>
                <span className='eyebrow'>
                  THE CONVERSATION <span className='eyebrow-slash'>/</span>{' '}
                  {String(questions.length).padStart(2, '0')} QUESTIONS
                </span>
                <h2>
                  {admin ? 'Instructor dashboard' : boardName}
                  <span className='period'>.</span>
                </h2>
                <p>Real questions from real humans, learning in real time.</p>
              </div>
              {admin && (
                <button
                  className='outline'
                  onClick={() => setPresenter(!presenter)}
                >
                  {presenter ? 'Exit presenter mode' : 'Presenter mode ↗'}
                </button>
              )}
            </div>
            {!presenter && (
              <div className='feed-bar'>
                <div className='tabs'>
                  {(['Hot', 'New', 'FAQ'] as const).map((t) => (
                    <button
                      key={t}
                      className={filter === t ? 'active' : ''}
                      onClick={() => setFilter(t)}
                    >
                      {t === 'Hot' && <Flame size={15} />} {t}
                    </button>
                  ))}
                </div>
                <span className='feed-note'>
                  <span className='green-dot' /> UPDATING LIVE
                </span>
              </div>
            )}
            {!configured && (
              <div className='notice'>
                The board is ready to connect. Add your Firebase configuration
                to start asking questions.
              </div>
            )}
            {error && (
              <div className='notice error' role='alert'>
                {error} <button onClick={() => setError('')}>×</button>
              </div>
            )}
            <div className='question-list'>
              {loading ? (
                <div className='empty'>Connecting to the board…</div>
              ) : !uid && configured ? (
                <div className='empty'>
                  The board is unavailable. Refresh the page to try again.
                </div>
              ) : items.length === 0 ? (
                <div className='empty'>
                  <CircleHelp size={25} />
                  <strong>
                    {filter === 'FAQ'
                      ? 'No answered questions yet.'
                      : 'A fresh start for curious minds.'}
                  </strong>
                  <span>
                    {filter === 'FAQ'
                      ? 'Answers will appear here as the course progresses.'
                      : 'Be the first to ask a question and get the conversation going.'}
                  </span>
                </div>
              ) : (
                items.map((q) => (
                  <article className='question-card' key={q.id}>
                    <button
                      className={`vote ${uid && q.upvotes?.includes(uid) ? 'voted' : ''}`}
                      onClick={() => vote(q)}
                      disabled={!uid || q.upvotes?.includes(uid)}
                      aria-label={`Upvote question, ${q.upvoteCount} votes`}
                    >
                      <ArrowUp size={19} />
                      <strong>{q.upvoteCount}</strong>
                    </button>
                    <div className='question-content'>
                      <div className='question-meta'>
                        <span className={`status ${q.status}`}>
                          ● &nbsp;{labels[q.status]}
                        </span>
                        <span>·</span>
                        <span>{timeAgo(q.createdAt?.seconds)}</span>
                      </div>
                      <div
                        className='question-title' role='button' tabIndex={0}
                        onClick={() => { setEditingReply(null); setReplyError(''); setSelected(q.id); }}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingReply(null); setReplyError(''); setSelected(q.id); } }}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml disallowedElements={['img', 'a']} unwrapDisallowed>{q.question}</ReactMarkdown>
                      </div>
                      {q.lessonReference && (
                        <Reference value={q.lessonReference} iconSize={13} />
                      )}
                      <div className='question-bottom'>
                        <span>
                          <Avatar name={q.authorName} authorUid={q.authorUid} />{' '}
                          {q.authorName || 'Anonymous'}
                        </span>
                        <button onClick={() => { setEditingReply(null); setReplyError(''); setSelected(q.id); }}>
                          <MessageCircle size={15} /> {q.replies?.length || 0}{' '}
                          {(q.replies?.length || 0) === 1 ? 'reply' : 'replies'}{' '}
                          <ArrowRight size={14} />
                        </button>
                      </div>
                      {!presenter && (admin || q.authorUid === uid) && (
                        <div className='admin-actions'>
                          {admin && <><button onClick={() => action(q.id, 'status', 'in_review')}>In review</button><button onClick={() => action(q.id, 'status', 'answered')}>Mark answered</button></>}
                          <button onClick={() => startEdit(q)}>Edit{!admin ? ' your question' : ''}</button>
                          {admin && <button onClick={() => { setDialogError(''); setDeleting(q); }}>Delete</button>}
                        </div>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
          {!presenter && (
            <aside>
              <form id='ask' className='ask-card' onSubmit={submit}>
                <div className='ask-icon'>
                  <Plus size={22} />
                </div>
                <div className='eyebrow'>YOUR TURN</div>
                <h2>
                  Ask away<span className='period'>.</span>
                </h2>
                <p>Big or small, every question moves us forward.</p>
                <ReplyEditor label='YOUR QUESTION' value={question} onChange={setQuestion} placeholder="What's on your mind?" />
                <label>
                  LESSON OR LINK <small>OPTIONAL</small>
                  <input
                    maxLength={500}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder='e.g. React hooks, GitHub link'
                  />
                </label>
                <label>
                  YOUR NAME <small>OPTIONAL</small>
                  <input
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder='Anonymous'
                  />
                </label>
                <button
                  className='primary'
                  disabled={!uid || !question.trim() || question.length > 2000 || cooldown > 0 || busy}
                  type='submit'
                >
                  {cooldown ? `Wait ${cooldown}s` : 'Post your question'}{' '}
                  <ArrowRight size={17} />
                </button>
                <div className='form-foot'>
                  <LockKeyhole size={13} /> NO ACCOUNT NEEDED. EDIT FROM THIS BROWSER WHILE SIGNED IN.
                </div>
              </form>
              <div className='aside-note'>
                <span>✳</span>
                <div>
                  <strong>A little reminder</strong>
                  <p>
                    If you're wondering about it, someone else probably is too.
                  </p>
                </div>
              </div>
              <div className='aside-bottom'>
                MADE FOR CURIOUS MINDS <span>↗</span>
              </div>
            </aside>
          )}
        </div>
      </main>
      <footer>
        <div>
          <span>
            KYQ<span className='period'>.</span>
          </span>
          <p>Better questions. Better builders.</p>
        </div>
        <span>QUESTION EVERYTHING &nbsp; ✳ &nbsp; KEEP CURIOUS</span>
      </footer>
      {editing && <Dialog title='Edit question' onClose={() => !busy && setEditing(null)}><form onSubmit={saveEdit}>
        <ReplyEditor label='EDIT YOUR QUESTION' autoFocus value={editQuestion} onChange={setEditQuestion} />
        <label>LESSON OR LINK <small>OPTIONAL</small><input maxLength={500} value={editReference} onChange={e => setEditReference(e.target.value)} /></label>
        {dialogError && <p className='error' role='alert'>{dialogError}</p>}
        <div className='dialog-actions'><button type='button' className='outline' disabled={busy} onClick={() => setEditing(null)}>Cancel</button><button className='primary' disabled={busy || !editQuestion.trim() || editQuestion.length > 2000}>{busy ? 'Saving…' : 'Save changes'}</button></div>
      </form></Dialog>}
      {deleting && <Dialog title='Delete question?' onClose={() => !busy && setDeleting(null)}><p>This will permanently delete this question and its replies.</p>{dialogError && <p className='error' role='alert'>{dialogError}</p>}<div className='dialog-actions'><button className='outline' disabled={busy} onClick={() => setDeleting(null)}>Cancel</button><button className='primary danger' disabled={busy} onClick={async () => { setBusy(true); if (await action(deleting.id, 'delete')) setDeleting(null); else setDialogError('Could not delete the question. Please try again.'); setBusy(false); }}>Delete question</button></div></Dialog>}
      {active && (
        <div className='modal-backdrop' onClick={() => setSelected(null)}>
          <section
            className='thread'
            role='dialog'
            aria-modal='true'
            aria-label='Question thread'
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className='close'
              onClick={() => setSelected(null)}
              aria-label='Close thread'
            >
              <X />
            </button>
            <span className='eyebrow'>THE CONVERSATION / THREAD</span>
            <span className={`status ${active.status}`}>
              ● &nbsp;{labels[active.status]}
            </span>
            <div className='thread-question reply-markdown'><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml disallowedElements={['img']}>{active.question}</ReactMarkdown></div>
            <div className='thread-meta'>
              <Avatar name={active.authorName} authorUid={active.authorUid} />
              <span>Asked by {active.authorName || 'Anonymous'} · {timeAgo(active.createdAt?.seconds)}</span>
            </div>
            {active.lessonReference && (
              <Reference value={active.lessonReference} iconSize={14} />
            )}
            <div className='thread-divider' />
            <h3>{active.replies?.length || 0} {(active.replies?.length || 0) === 1 ? 'reply' : 'replies'}</h3>{replyError && <p className='error' role='alert'>{replyError}</p>}
            <div className='replies'>
              {active.replies?.length ? (
                active.replies.map((r, i) => (
                  <div className='reply' key={r.id || i}>
                    <Avatar name={r.author} authorUid={r.authorUid} />
                    <div>
                      <strong>{r.author}</strong>
                      <span>
                        {' '}
                        ·{' '}
                        {timeAgo(
                          Math.floor(new Date(r.createdAt).getTime() / 1000),
                        )}
                      </span>
                      {editingReply === r.id && r.id ? <form onSubmit={e => { e.preventDefault(); void saveReply(true); }} className='reply-edit'>
                        <ReplyEditor label='EDIT YOUR REPLY' autoFocus value={replyDraft} onChange={setReplyDraft} />
                        <div className='dialog-actions'><button type='button' className='outline' disabled={busy} onClick={() => { setEditingReply(null); setReplyError(''); }}>Cancel</button><button className='primary' disabled={busy || !replyDraft.trim() || replyDraft.length > 2000}>{busy ? 'Saving…' : 'Save changes'}</button></div>
                      </form> : <><div className='reply-markdown'><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml disallowedElements={['img']}>{r.text}</ReactMarkdown></div>{r.id && r.authorUid === uid && <button type='button' className='outline edit-reply-button' onClick={() => { setEditingReply(r.id!); setReplyDraft(r.text); setReplyError(''); }}>Edit your reply</button>}</>}
                    </div>
                  </div>
                ))
              ) : (
                <p className='muted'>No replies yet. Start the conversation.</p>
              )}
            </div>
            <form onSubmit={addReply}>
              <ReplyEditor label='YOUR REPLY' value={reply} onChange={setReply} placeholder='Share what you know...' />
              <input
                maxLength={80}
                value={replyName}
                onChange={(e) => setReplyName(e.target.value)}
                placeholder='Your name (optional)'
              />
              <button
                className='primary'
                disabled={!uid || busy || !reply.trim() || reply.length > 2000}
              >
                Post reply <Send size={15} />
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
