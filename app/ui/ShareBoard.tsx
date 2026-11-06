'use client';
import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import Dialog from './Dialog';

export default function ShareBoard({ board, onClose }: { board: {id:string; name:string}; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [message, setMessage] = useState('');
  const url = `${window.location.origin}/boards/${encodeURIComponent(board.id)}`;
  async function copy() {
    try { await navigator.clipboard.writeText(url); setMessage('Link copied.'); }
    catch { setMessage('Could not copy the link. Select and copy it below.'); }
  }
  function download() {
    if (!canvas.current) return;
    const link = document.createElement('a');
    link.href = canvas.current.toDataURL('image/png');
    link.download = `kyq-board-${board.id}-qr.png`;
    link.click();
  }
  return <Dialog title='Share board' onClose={onClose}>
    <p>Share this link or QR code for “{board.name}”. Participants will also need the board password.</p>
    <div className='share-qr'><QRCodeCanvas ref={canvas} value={url} size={240} marginSize={4} aria-label={`QR code for ${board.name}`} /></div>
    <label>BOARD LINK<input readOnly value={url} onFocus={e => e.currentTarget.select()} /></label>
    {message && <p role='status'>{message}</p>}
    <div className='share-actions'><button className='outline' type='button' onClick={copy}>Copy link</button><button className='outline' type='button' onClick={download}>Download QR code</button></div>
  </Dialog>;
}
