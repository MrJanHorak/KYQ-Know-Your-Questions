'use client';
import { useEffect, useRef } from 'react';

export default function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => { dialog?.close(); }; }, []);
  return <dialog ref={ref} className='dialog' aria-labelledby='dialog-title' onCancel={e => { e.preventDefault(); onClose(); }}>
    <div className='dialog-heading'><h2 id='dialog-title'>{title}</h2><button type='button' className='dialog-close' aria-label='Close' onClick={onClose}>×</button></div>
    {children}
  </dialog>;
}
