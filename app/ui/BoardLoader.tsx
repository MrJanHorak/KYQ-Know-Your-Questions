'use client';
import dynamic from 'next/dynamic';

const Board = dynamic(() => import('./Board'), {
  ssr: false,
  loading: () => <main className='login-wrap'><div className='login card'><span className='eyebrow'>PRIVATE BOARD</span><p>Opening your board…</p></div></main>,
});

export default function BoardLoader({boardId, admin = false}: {boardId:string; admin?:boolean}) {
  return <Board boardId={boardId} admin={admin}/>;
}
