'use client';

import { useEffect, useRef } from 'react';

export default function VerificationCode({value,onChange,disabled=false,autoFocus=false,focusRequest=0}:{value:string;onChange:(value:string)=>void;disabled?:boolean;autoFocus?:boolean;focusRequest?:number}) {
  const inputs=useRef<(HTMLInputElement|null)[]>([]);
  const handledFocus=useRef(0);
  useEffect(()=>{if(!disabled && focusRequest!==handledFocus.current){inputs.current[0]?.focus();handledFocus.current=focusRequest;}},[disabled,focusRequest]);
  const digits=value.padEnd(6,' ').slice(0,6).split('');
  function put(index:number,text:string) {
    const incoming=text.replace(/\D/g,'').slice(0,6-index);
    if (!incoming && text) return;
    const next=[...digits];
    if (!incoming) next[index]=' ';
    else incoming.split('').forEach((digit,offset)=>{next[index+offset]=digit;});
    onChange(next.join('').trimEnd());
    if (incoming) inputs.current[Math.min(index+incoming.length,5)]?.focus();
  }
  return <fieldset className='verification-code' disabled={disabled}>
    <legend>AUTHENTICATOR CODE</legend>
    <div className='verification-code-inputs'>
      {digits.map((digit,index)=><input key={index} ref={element=>{inputs.current[index]=element;}} type='text' inputMode='numeric' pattern='[0-9]*' autoComplete={index===0?'one-time-code':'off'} autoFocus={autoFocus&&index===0} aria-label={`Digit ${index+1} of 6`} value={digit===' '?'':digit} onFocus={event=>event.currentTarget.select()} onChange={event=>put(index,event.target.value)} onPaste={event=>{event.preventDefault();put(index,event.clipboardData.getData('text'));}} onKeyDown={event=>{if(event.key==='Backspace' && digits[index]===' ' && index>0){event.preventDefault();const next=[...digits];next[index-1]=' ';onChange(next.join('').trimEnd());inputs.current[index-1]?.focus();}else if(event.key==='ArrowLeft' && index>0){event.preventDefault();inputs.current[index-1]?.focus();}else if(event.key==='ArrowRight' && index<5){event.preventDefault();inputs.current[index+1]?.focus();}}}/>)}
    </div>
  </fieldset>;
}
