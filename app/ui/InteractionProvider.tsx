'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { EmailAuthProvider, getMultiFactorResolver, reauthenticateWithCredential, TotpMultiFactorGenerator, type MultiFactorError, type MultiFactorResolver, type User } from 'firebase/auth';
import { instructorAuth } from '../../lib/instructorFirebase';
import Dialog from './Dialog';
import VerificationCode from './VerificationCode';
import { verificationError } from '../../lib/verificationError';

type Confirmation={title:string;message:string;confirmLabel?:string;danger?:boolean};
type Interaction={confirm:(options:Confirmation)=>Promise<boolean>;reauthenticate:(user:User,reason?:string)=>Promise<boolean>};
type Request=({kind:'confirm';options:Confirmation}|{kind:'reauth';user:User;reason:string}) & {resolve:(result:boolean)=>void};
const Context=createContext<Interaction|null>(null);

export function useInteraction() {const value=useContext(Context);if(!value)throw new Error('InteractionProvider is missing.');return value;}

export default function InteractionProvider({children}:{children:React.ReactNode}) {
  const [request,setRequest]=useState<Request|null>(null);
  const active=useRef<Request|null>(null);
  const open=useCallback((next:Omit<Extract<Request,{kind:'confirm'}>,'resolve'>|Omit<Extract<Request,{kind:'reauth'}>,'resolve'>)=>new Promise<boolean>(resolve=>{if(active.current){resolve(false);return;}const item={...next,resolve} as Request;active.current=item;setRequest(item);}),[]);
  const finish=useCallback((result:boolean)=>{const item=active.current;if(!item)return;active.current=null;setRequest(null);item.resolve(result);},[]);
  useEffect(()=>()=>{active.current?.resolve(false);active.current=null;},[]);
  const confirm=useCallback((options:Confirmation)=>open({kind:'confirm',options}),[open]);
  const reauthenticate=useCallback((user:User,reason='Confirm your password to continue.')=>open({kind:'reauth',user,reason}),[open]);
  return <Context.Provider value={{confirm,reauthenticate}}>{children}
    {request?.kind==='confirm' && <Dialog title={request.options.title} onClose={()=>finish(false)}><p>{request.options.message}</p><div className='dialog-actions'><button type='button' className='outline' onClick={()=>finish(false)}>Cancel</button><button type='button' className={`primary${request.options.danger?' danger':''}`} onClick={()=>finish(true)}>{request.options.confirmLabel||'Confirm'}</button></div></Dialog>}
    {request?.kind==='reauth' && <ReauthenticationDialog user={request.user} reason={request.reason} onFinish={finish}/>}
  </Context.Provider>;
}

function ReauthenticationDialog({user,reason,onFinish}:{user:User;reason:string;onFinish:(ok:boolean)=>void}) {
  const [password,setPassword]=useState(''),[code,setCode]=useState(''),[resolver,setResolver]=useState<MultiFactorResolver|null>(null),[factorUid,setFactorUid]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [focusRequest,setFocusRequest]=useState(0);
  async function submit(event:React.FormEvent) {
    event.preventDefault();setBusy(true);setError('');
    try {
      if(resolver){await resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(factorUid,code));}
      else {
        if(!user.email)throw new Error('This account has no email address.');
        try {await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,password));}
        catch(cause) {
          if((cause as {code?:string}).code!=='auth/multi-factor-auth-required')throw cause;
          if(!instructorAuth)throw new Error('Instructor authentication is not configured.');
          const next=getMultiFactorResolver(instructorAuth,cause as MultiFactorError);
          const factor=next.hints.find(hint=>hint.factorId===TotpMultiFactorGenerator.FACTOR_ID);
          if(!factor)throw new Error('No supported authenticator factor is available.');
          setPassword('');setFactorUid(factor.uid);setResolver(next);return;
        }
      }
      await user.getIdToken(true);onFinish(true);
    } catch(cause) {
      if(resolver){const result=verificationError(cause);if(result.clearCode){setCode('');setFocusRequest(count=>count+1);}setError(result.message);}
      else {const errorCode=(cause as {code?:string}).code;setError(errorCode==='auth/too-many-requests'?'Too many attempts. Please wait and try again.':'Could not verify your password. Please try again.');}
    } finally {setBusy(false);}
  }
  return <Dialog title={resolver?'Verify it’s you':'Confirm it’s you'} onClose={()=>{if(!busy)onFinish(false);}}><form className='security-form' onSubmit={event=>void submit(event)}><p>{resolver?'Enter the six-digit code from your authenticator app.':reason}</p>{resolver?<VerificationCode value={code} onChange={setCode} disabled={busy} autoFocus focusRequest={focusRequest}/>:<label>PASSWORD<input type='password' autoComplete='current-password' value={password} onChange={event=>setPassword(event.target.value)} autoFocus required disabled={busy}/></label>}{error&&<p className='security-error' role='alert'>{error}</p>}<div className='dialog-actions'><button type='button' className='outline' disabled={busy} onClick={()=>onFinish(false)}>Cancel</button><button className='primary' disabled={busy || (resolver?!/^\d{6}$/.test(code):!password)}>{busy?'Checking…':'Continue'}</button></div></form></Dialog>;
}
