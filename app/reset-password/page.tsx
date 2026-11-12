'use client';

import { useEffect, useState } from 'react';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { Code2 } from 'lucide-react';
import { instructorAuth } from '../../lib/instructorFirebase';

export default function ResetPasswordPage() {
  const [code, setCode] = useState('');
  const [state, setState] = useState<'checking' | 'ready' | 'done' | 'invalid'>('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const actionCode = params.get('oobCode');
    if (params.get('mode') !== 'resetPassword' || !actionCode || !instructorAuth) { setState('invalid'); return; }
    setCode(actionCode);
    verifyPasswordResetCode(instructorAuth, actionCode).then(() => setState('ready')).catch(() => setState('invalid'));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!instructorAuth || busy) return;
    if (password !== confirmation) { setError('Passwords do not match. Please try again.'); return; }
    setBusy(true); setError('');
    try { await confirmPasswordReset(instructorAuth, code, password); setPassword(''); setConfirmation(''); setState('done'); }
    catch (cause) {
      const code = (cause as { code?: string }).code;
      setError(code === 'auth/weak-password' || code === 'auth/password-does-not-meet-requirements' ? 'This password does not meet the account password requirements. Try a longer, stronger password.' : code === 'auth/expired-action-code' || code === 'auth/invalid-action-code' ? 'This reset link has expired or has already been used. Request a new one.' : 'Could not update your password. Please try again.');
    } finally { setBusy(false); }
  }

  return <main className='login-wrap'><div className='login card'>
    <div className='brand-mark'><Code2 size={21}/></div><span className='eyebrow'>INSTRUCTOR ACCOUNT</span>
    {state === 'checking' ? <><h1>Checking your link.</h1><p>Please wait…</p></> : state === 'invalid' ? <><h1>Link unavailable.</h1><p>This reset link is invalid or has expired. Please request a new one.</p></> : state === 'done' ? <><h1>Password updated.</h1><p>You can now sign in with your new password.</p></> : <form onSubmit={submit}>
      <h1>Update your password.</h1><p>Enter your new password twice to confirm it.</p>
      <label>NEW PASSWORD<input type='password' autoComplete='new-password' minLength={6} value={password} onChange={e => { setPassword(e.target.value); setError(''); }} required /></label>
      <label>CONFIRM PASSWORD<input type='password' autoComplete='new-password' value={confirmation} onChange={e => { setConfirmation(e.target.value); setError(''); }} aria-invalid={error === 'Passwords do not match. Please try again.'} aria-describedby={error ? 'reset-error' : undefined} required /></label>
      {error && <p id='reset-error' className='account-error' role='alert'>{error}</p>}
      <div className='account-actions'><button className='primary' disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button></div>
    </form>}
    <a href='/instructor'>← Back to sign in</a>
  </div></main>;
}
