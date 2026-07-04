import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SIRCLE Planner',
  description: 'White-label afsprakenplanner met agenda-sync — Fase 1 demo.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
