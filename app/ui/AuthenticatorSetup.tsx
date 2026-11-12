'use client';
import { useState } from 'react';
import { multiFactor, TotpMultiFactorGenerator, type TotpSecret, type User } from 'firebase/auth';
import { QRCodeSVG } from 'qrcode.react';
import { Check, ShieldCheck } from 'lucide-react';
import Dialog from './Dialog';
import { useInteraction } from './InteractionProvider';
import VerificationCode from './VerificationCode';

export default function AuthenticatorSetup({user}:{user:User}) {
  const {reauthenticate}=useInteraction();
  const [secret,setSecret]=useState<TotpSecret|null>(null),[code,setCode]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[enrolled,setEnrolled]=useState(()=>multiFactor(user).enrolledFactors.length>0);
  async function start() {
    setBusy(true);setMessage('');setError('');
    try {
      if(!await reauthenticate(user,'Confirm your password to set up two-step verification.'))return;
      const session=await multiFactor(user).getSession();
      setSecret(await TotpMultiFactorGenerator.generateSecret(session));
    } catch {setMessage('Could not start authenticator setup. Please try again.');}
    finally {setBusy(false);}
  }
  async function finish(event:React.FormEvent) {
    event.preventDefault();if(!secret||!/^\d{6}$/.test(code))return;setBusy(true);setError('');
    try {await multiFactor(user).enroll(TotpMultiFactorGenerator.assertionForEnrollment(secret,code),'Authenticator app');setSecret(null);setCode('');setEnrolled(true);setMessage('Authenticator enabled. You’ll use a code the next time you sign in.');}
    catch {setError('Could not verify that code. Check your authenticator and try again.');}
    finally {setBusy(false);}
  }
  function close(){if(!busy){setSecret(null);setCode('');setError('');}}
  return <section className='account-security'><div className='account-security-icon'><ShieldCheck size={20}/></div><div className='account-security-content'><div className='account-security-heading'><div><span className='eyebrow'>ACCOUNT SECURITY</span><h2>Two-step verification</h2></div>{enrolled&&<span className='security-badge'><Check size={13}/> Enabled</span>}</div><p>{enrolled?'Your account is protected with an authenticator app.':'Add an authenticator app for an extra layer of protection when you sign in.'}</p>{!enrolled&&<button type='button' className='outline security-setup-button' disabled={busy} onClick={()=>void start()}>Set up authenticator</button>}{message&&<p className='security-status' role='status'>{message}</p>}</div>
    {secret&&<Dialog title='Set up your authenticator' onClose={close}><form className='security-form' onSubmit={event=>void finish(event)}><p>Scan this QR code with your authenticator app, then enter the six-digit code it generates.</p><div className='security-qr'><QRCodeSVG value={secret.generateQrCodeUrl(user.email || undefined,'Know Your Questions')} size={172} aria-label='Authenticator setup QR code'/></div><details className='security-manual'><summary>Can’t scan the code?</summary><p>Enter this setup key in your authenticator app:</p><code>{secret.secretKey}</code></details><VerificationCode value={code} onChange={setCode} disabled={busy}/><p className='security-hint'>Keep a secure backup of your authenticator so you don’t lose access to your account.</p>{error&&<p className='security-error' role='alert'>{error}</p>}<div className='dialog-actions'><button type='button' className='outline' disabled={busy} onClick={close}>Cancel</button><button className='primary' disabled={busy||!/^\d{6}$/.test(code)}>{busy?'Verifying…':'Verify and enable'}</button></div></form></Dialog>}
  </section>;
}
