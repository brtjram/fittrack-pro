'use client';

import { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';

const APP_SCHEME = 'com.brtjram.fittrackpro';

export default function MobileAuthPage() {
  const { data: session, status } = useSession();
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      signIn('google', { callbackUrl: '/mobile-auth' });
      return;
    }

    if (status === 'authenticated') {
      fetch('/api/auth/mobile-google-token', { method: 'POST' })
        .then((r) => r.json())
        .then((data) => {
          if (!data.token) {
            setError('Could not generate token. Please try again.');
            return;
          }
          const params = new URLSearchParams({
            token: data.token,
            id: data.user.id,
            name: data.user.name ?? '',
            email: data.user.email ?? '',
          });
          window.location.href = `${APP_SCHEME}://auth?${params.toString()}`;
        })
        .catch(() => setError('Something went wrong. Please close this window and try again.'));
    }
  }, [status, session]);

  return (
    <div style={styles.container}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={styles.card}>
        <div style={styles.logo}>FT</div>
        <h2 style={styles.title}>FitTrack Pro</h2>
        {error ? (
          <p style={styles.error}>{error}</p>
        ) : (
          <>
            <div style={styles.spinner} />
            <p style={styles.message}>
              {status === 'authenticated' ? 'Opening the app…' : 'Signing you in…'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex', height: '100vh', alignItems: 'center',
    justifyContent: 'center', background: '#f7f7f7', fontFamily: 'system-ui, sans-serif',
  },
  card: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: '#fff', borderRadius: 20, padding: '40px 48px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)', gap: 12,
  },
  logo: {
    width: 56, height: 56, borderRadius: 14, background: '#0d0d0d',
    color: '#c8ff00', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20, fontWeight: 900, letterSpacing: -0.5,
  },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: '#0d0d0d' },
  message: { margin: 0, fontSize: 14, color: '#888' },
  error: { margin: 0, fontSize: 14, color: '#ef4444', textAlign: 'center', maxWidth: 260 },
  spinner: {
    width: 24, height: 24, border: '3px solid #ebebeb',
    borderTopColor: '#0d0d0d', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};
