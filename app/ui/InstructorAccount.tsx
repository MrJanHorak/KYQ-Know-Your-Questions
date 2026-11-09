'use client';

import { useEffect, useState } from 'react';
import { Code2 } from 'lucide-react';
import { createUserWithEmailAndPassword, onAuthStateChanged, reload, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { instructorAuth } from '../../lib/instructorFirebase';
import InstructorBoards from './InstructorBoards';

function authErrorMessage(error: unknown, creating: boolean) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? (error as {code?: unknown}).code : undefined;
  switch (code) {
    case 'auth/operation-not-allowed': return 'Email and password sign-in is not enabled for this Firebase project. An administrator needs to enable it in Firebase Authentication.';
    case 'auth/admin-restricted-operation': return 'Account creation is disabled for this Firebase project. An administrator needs to check the Firebase Authentication settings.';
    case 'auth/email-already-in-use': return 'An account already uses this email. Sign in or reset your password instead.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements': return 'This password does not meet the account password requirements. Try a longer, stronger password.';
    case 'auth/too-many-requests': return 'Too many attempts. Please wait a while and try again.';
    case 'auth/network-request-failed': return 'Could not connect to the sign-in service. Check your connection and try again.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid': return 'The Firebase sign-in configuration is invalid. Contact the site administrator.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'Could not sign in. Check your email and password or reset your password.';
    default: {
      const safeCode = typeof code === 'string' && /^auth\/[a-z0-9-]+$/.test(code) ? ` (${code})` : '';
      return creating ? `Could not create your account${safeCode}. Please try again. If the problem continues, contact the site administrator.` : `Could not sign in${safeCode}. Please try again.`;
    }
  }
}

export default function InstructorAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [create, setCreate] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [authError, setAuthError] = useState('');
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
    if (create && password !== confirmPassword) { setMessage(''); setAuthError(''); setPasswordMismatch(true); return; }
    setPasswordMismatch(false);
    setBusy(true); setMessage(''); setAuthError('');
    try {
      if (create) {
        const credential = await createUserWithEmailAndPassword(instructorAuth, email.trim(), password);
        setPassword('');
        setConfirmPassword('');
        try { await sendEmailVerification(credential.user); setMessage('Check your email for a verification link, then return here.'); }
        catch { setMessage('Your account was created, but the verification email could not be sent. Use Resend verification email below.'); }
      } else {
        const credential = await signInWithEmailAndPassword(instructorAuth, email.trim(), password);
        setPassword('');
        if (!credential.user.emailVerified) setMessage('Verify your email before continuing.');
      }
    } catch (error) { setAuthError(authErrorMessage(error, create)); }
    finally { setBusy(false); }
  }
  async function refresh() {
    if (!user) return; setBusy(true); setMessage('');
    try { await reload(user); if (!user.emailVerified) { setMessage('Your email is not verified yet.'); return; } await setup(user); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not set up your account. Please try again.'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!user?.emailVerified || teamReady) return;
    let active = true;
    (async () => { try { const token = await user.getIdToken(true); const response = await fetch('/api/instructor/account', {method:'POST', headers:{Authorization:`Bearer ${token}`}}); if (!response.ok) { const result = await response.json(); throw new Error(result.error || 'Could not set up your account. Please try again.'); } if (active) setTeamReady(true); } catch (error) { if (active) setMessage(error instanceof Error ? error.message : 'Could not set up your account. Please try again.'); } })();
    return () => { active = false; };
  }, [user, teamReady]);

  return <main className='login-wrap'><div className={`login card${teamReady ? ' instructor-dashboard' : ''}`}>
    <div className='brand-mark'><Code2 size={21}/></div><span className='eyebrow'>INSTRUCTOR ACCOUNT</span>
    {teamReady && <div className='dashboard-brand-art' aria-hidden='true'><span className='dashboard-brand-sparkle'>✳</span><div className='dashboard-brand-card'><span className='dashboard-brand-label'>ASK MORE</span><span className='dashboard-brand-question'>?</span><span className='dashboard-brand-arrow'>↗</span></div></div>}
    {!ready ? <p>Loading your account…</p> : !instructorAuth ? <p>Firebase is not configured.</p> : user ? <>
      <h1>{teamReady ? 'Your account is ready.' : user.emailVerified ? 'Set up your account.' : 'Verify your email.'}</h1>
      <p>Signed in as {user.email}.</p>
      {teamReady ? <><p>Your personal team is ready. Invitations are still being built.</p><InstructorBoards user={user}/></> : null}
      <div className={teamReady ? 'account-actions dashboard-actions' : 'account-actions'}>
      {!teamReady && <>
        <button className='primary' disabled={busy} onClick={refresh}>{user.emailVerified ? 'Retry account setup' : 'I have verified my email'}</button>
        {!user.emailVerified && <button className='outline' disabled={busy} onClick={async () => { setBusy(true); try { await sendEmailVerification(user); setMessage('Verification email sent.'); } catch { setMessage('Could not send the verification email. Please try again later.'); } finally { setBusy(false); } }}>Resend verification email</button>}
      </>}
      <button className='outline' disabled={busy} onClick={() => { setMessage(''); if (instructorAuth) void signOut(instructorAuth); }}>Sign out</button>
      </div>
    </> : <form onSubmit={submit}>
      <h1>{create ? 'Create your account.' : 'Welcome back.'}</h1>
      <p>Sign in or create an account to manage your own boards. Shared instructor management is still being built.</p>
      <label>EMAIL<input type='email' autoComplete='email' value={email} onChange={e=>setEmail(e.target.value)} required /></label>
      <label>PASSWORD<input type='password' autoComplete={create ? 'new-password' : 'current-password'} minLength={6} value={password} onChange={e=>{setPassword(e.target.value);setPasswordMismatch(false);}} required /></label>
      {create && <><label>CONFIRM PASSWORD<input type='password' autoComplete='new-password' value={confirmPassword} onChange={e=>{setConfirmPassword(e.target.value);setPasswordMismatch(false);}} aria-invalid={passwordMismatch} aria-describedby={passwordMismatch ? 'password-mismatch' : undefined} required /></label>{passwordMismatch && <p id='password-mismatch' className='account-error' role='alert'>Passwords do not match. Please try again.</p>}</>}
      {authError && <p className='account-error' role='alert'>{authError}</p>}
      <div className='account-actions'>
      <button className='primary' disabled={busy}>{create ? 'Create account' : 'Sign in'}</button>
      <button type='button' className='outline' onClick={()=>{setCreate(!create);setConfirmPassword('');setPasswordMismatch(false);setMessage('');setAuthError('');}}>{create ? 'Already have an account? Sign in' : 'Create an account'}</button>
      {!create && <button type='button' className='outline' disabled={busy || !email.trim()} onClick={async () => { if (!instructorAuth) return; setBusy(true); try { await sendPasswordResetEmail(instructorAuth, email.trim()); setMessage('If an account exists for that email, a reset link has been sent.'); } catch { setMessage('Could not request a reset link. Please try again later.'); } finally { setBusy(false); } }}>Reset password</button>}
      </div>
    </form>}
    {message && <p role='status'>{message}</p>}<a href='/'>← Back to KYQ</a>
  </div></main>;
}
