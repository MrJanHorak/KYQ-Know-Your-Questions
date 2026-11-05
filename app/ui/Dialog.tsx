'use client';
import { useEffect, useId, useRef } from 'react';

export default function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => { dialog?.close(); }; }, []);
  return <dialog ref={ref} className='dialog' aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }}>
    <div className='dialog-heading'><h2 id={titleId}>{title}</h2><button type='button' className='dialog-close' aria-label='Close' onClick={onClose}>×</button></div>
    {children}
  </dialog>;
}
