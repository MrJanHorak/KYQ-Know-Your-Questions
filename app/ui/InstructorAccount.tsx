'use client';

import { useEffect, useState } from 'react';
import { Code2 } from 'lucide-react';
import { createUserWithEmailAndPassword, onAuthStateChanged, reload, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { instructorAuth } from '../../lib/instructorFirebase';

export default function InstructorAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [create, setCreate] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [teamReady, setTeamReady] = useState(false);

  useEffect(() => {
    if (!instructorAuth) { setReady(true); return; }
    return onAuthStateChanged(instructorAuth, current => { setUser(current); setTeamReady(false); setReady(true); });
  }, []);

  async function setup(current: User) {
    const token = await current.getIdToken(true);
    const response = await fetch('/api/instructor/account', {method:'POST', headers:{Authorization:`Bearer ${token}`}});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Account setup failed.');
    setTeamReady(true);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!instructorAuth) return;
    setBusy(true); setMessage('');
    try {
      if (create) {
        const credential = await createUserWithEmailAndPassword(instructorAuth, email.trim(), password);
        setPassword('');
        try { await sendEmailVerification(credential.user); setMessage('Check your email for a verification link, then return here.'); }
        catch { setMessage('Your account was created, but the verification email could not be sent. Use Resend verification email below.'); }
      } else {
        const credential = await signInWithEmailAndPassword(instructorAuth, email.trim(), password);
        setPassword('');
        if (!credential.user.emailVerified) setMessage('Verify your email before continuing.');
      }
    } catch { setMessage(create ? 'Could not create your account. Check your email and password and try again.' : 'Could not sign in. Check your email and password and try again.'); }
    finally { setBusy(false); }
  }
  async function refresh() {
    if (!user) return; setBusy(true); setMessage('');
    try { await reload(user); if (!user.emailVerified) { setMessage('Your email is not verified yet.'); return; } await setup(user); }
    catch { setMessage('Could not set up your account. Please try again.'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!user?.emailVerified || teamReady) return;
    let active = true;
    (async () => { try { const token = await user.getIdToken(true); const response = await fetch('/api/instructor/account', {method:'POST', headers:{Authorization:`Bearer ${token}`}}); if (!response.ok) throw new Error(); if (active) setTeamReady(true); } catch { if (active) setMessage('Could not set up your account. Please try again.'); } })();
    return () => { active = false; };
  }, [user, teamReady]);

  return <main className='login-wrap'><div className='login card'>
    <div className='brand-mark'><Code2 size={21}/></div><span className='eyebrow'>INSTRUCTOR ACCOUNT</span>
    {!ready ? <p>Loading your account…</p> : !instructorAuth ? <p>Firebase is not configured.</p> : user ? <>
      <h1>{teamReady ? 'Your account is ready.' : user.emailVerified ? 'Set up your account.' : 'Verify your email.'}</h1>
      <p>Signed in as {user.email}.</p>
      {teamReady ? <p>Your personal team is ready. Board management and team invitations are still being connected to instructor accounts. The existing dashboard remains available in the meantime.</p> : <>
        <button className='primary' disabled={busy} onClick={refresh}>{user.emailVerified ? 'Retry account setup' : 'I have verified my email'}</button>
        {!user.emailVerified && <button className='outline' disabled={busy} onClick={async () => { setBusy(true); try { await sendEmailVerification(user); setMessage('Verification email sent.'); } catch { setMessage('Could not send the verification email. Please try again later.'); } finally { setBusy(false); } }}>Resend verification email</button>}
      </>}
      <button className='outline' disabled={busy} onClick={() => { setMessage(''); if (instructorAuth) void signOut(instructorAuth); }}>Sign out</button>
    </> : <form onSubmit={submit}>
      <h1>{create ? 'Create your account.' : 'Welcome back.'}</h1>
      <p>Instructor accounts are being prepared for teams and shared board management.</p>
      <label>EMAIL<input type='email' autoComplete='email' value={email} onChange={e=>setEmail(e.target.value)} required /></label>
      <label>PASSWORD<input type='password' autoComplete={create ? 'new-password' : 'current-password'} minLength={6} value={password} onChange={e=>setPassword(e.target.value)} required /></label>
      <button className='primary' disabled={busy}>{create ? 'Create account' : 'Sign in'}</button>
      <button type='button' className='outline' onClick={()=>{setCreate(!create);setMessage('');}}>{create ? 'Already have an account? Sign in' : 'Create an account'}</button>
      {!create && <button type='button' className='outline' disabled={busy || !email.trim()} onClick={async () => { if (!instructorAuth) return; setBusy(true); try { await sendPasswordResetEmail(instructorAuth, email.trim()); setMessage('If an account exists for that email, a reset link has been sent.'); } catch { setMessage('Could not request a reset link. Please try again later.'); } finally { setBusy(false); } }}>Reset password</button>}
    </form>}
    {message && <p role='status'>{message}</p>}<a href='/admin'>Go to the existing instructor dashboard →</a><a href='/'>← Back to KYQ</a>
  </div></main>;
}
