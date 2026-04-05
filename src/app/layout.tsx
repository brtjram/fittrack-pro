import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { BottomNav } from '@/components/layout/bottom-nav';
import { SessionState } from '@/components/layout/session-state';
import { auth } from '@/auth';
import './globals.css';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
  fallback: ['system-ui', 'arial'],
});

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
  fallback: ['ui-monospace', 'monospace'],
});

export const metadata: Metadata = {
  title: 'FitTrack Pro',
  description: 'Expert workout planner, smart nutrition tracker, and analytics dashboard',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider>
          <SessionState />
          <main className={session?.user ? 'pb-nav' : undefined}>{children}</main>
          {session?.user ? <BottomNav /> : null}
        </ThemeProvider>
      </body>
    </html>
  );
}
