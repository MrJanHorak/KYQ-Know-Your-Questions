import type { Metadata } from 'next';
import './globals.css';
import InteractionProvider from './ui/InteractionProvider';
export const metadata: Metadata = { title: 'KYQ — Know Your Questions', description: 'A shared space for curious minds to ask, learn, and build together.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><InteractionProvider>{children}</InteractionProvider></body></html>; }
