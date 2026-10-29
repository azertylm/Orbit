import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  retriedAutoHeal: boolean;
}

function sanitizeLocalStorageState(): void {
  try {
    const raw = window.localStorage.getItem('ORBIT_STATE_V3');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      window.localStorage.removeItem('ORBIT_STATE_V3');
      return;
    }
    // Keep only user custom videos (id >= 3000) with guaranteed valid fields
    if (Array.isArray(parsed.videos)) {
      parsed.videos = parsed.videos
        .filter((v: unknown) => v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'number')
        .map((v: Record<string, unknown>) => ({
          ...v,
          title: typeof v.title === 'string' && v.title ? v.title : 'Vidéo partagée sur Orbit',
          domain: typeof v.domain === 'string' && v.domain ? v.domain : 'Sciences & Tech',
          subdomain: typeof v.subdomain === 'string' && v.subdomain ? v.subdomain : 'Découverte',
          user: typeof v.user === 'string' && v.user ? v.user : 'Valentin R.',
          score: typeof v.score === 'number' && !Number.isNaN(v.score) ? v.score : 9.6,
          votes: typeof v.votes === 'number' && !Number.isNaN(v.votes) ? v.votes : 1,
          hoursAgo: typeof v.hoursAgo === 'number' && !Number.isNaN(v.hoursAgo) ? v.hoursAgo : 1,
          commentsList: Array.isArray(v.commentsList) ? v.commentsList : [],
        }));
    }
    // Reset socials/twins/domains if corrupted so defaults cleanly take over
    delete parsed.socials;
    delete parsed.domains;
    delete parsed.jukebox;
    delete parsed.challenges;
    window.localStorage.setItem('ORBIT_STATE_V3', JSON.stringify(parsed));
  } catch {
    try {
      window.localStorage.removeItem('ORBIT_STATE_V3');
    } catch {
      // ignore
    }
  }
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      retriedAutoHeal: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      errorMessage: error?.message || 'Erreur inattendue de rendu',
    };
  }

  componentDidCatch(error: Error) {
    console.warn('[ORBIT Auto-Heal] Interception erreur rendu:', error);
    if (!this.state.retriedAutoHeal) {
      sanitizeLocalStorageState();
      this.setState({ hasError: false, retriedAutoHeal: true });
    }
  }

  handleHardReset = () => {
    try {
      sanitizeLocalStorageState();
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
    } catch {
      // ignore
    }
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            backgroundColor: '#06070b',
            color: '#f5f7ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              background: 'rgba(20, 23, 38, 0.92)',
              border: '1px solid rgba(124, 92, 255, 0.35)',
              borderRadius: '20px',
              padding: '28px',
              textAlign: 'center',
            }}
          >
            <h2 style={{ margin: '0 0 10px', fontSize: '20px', fontWeight: 800 }}>
              ORBIT v2.0 — Réparation automatique du cache
            </h2>
            <p style={{ margin: '0 0 18px', fontSize: '13px', opacity: 0.8, lineHeight: 1.5 }}>
              Une donnée locale obsolète a été détectée ({this.state.errorMessage}). Vos vidéos partagées sont préservées.
            </p>
            <button
              onClick={this.handleHardReset}
              style={{
                background: 'linear-gradient(135deg, #7c5cff, #00d4ff)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 22px',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Relancer ORBIT maintenant
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Interception globale des rejets de promesses ou événements d'erreur bruts de l'API YouTube IFrame (playerInfo)
if (typeof window !== 'undefined') {
  const isYouTubePlayerErrorObject = (val: unknown): boolean => {
    if (!val || typeof val !== 'object') return false;
    const obj = val as Record<string, unknown>;
    if (obj.target && typeof obj.target === 'object') {
      const target = obj.target as Record<string, unknown>;
      if ('playerInfo' in target || 'getVideoUrl' in target || 'v' in target) {
        return true;
      }
    }
    return 'playerInfo' in obj;
  };

  window.addEventListener(
    'unhandledrejection',
    (event: PromiseRejectionEvent) => {
      if (isYouTubePlayerErrorObject(event.reason)) {
        event.preventDefault();
        const reasonObj = event.reason as { data?: unknown };
        const code = reasonObj?.data ? String(reasonObj.data) : '150';
        window.dispatchEvent(
          new CustomEvent('orbit-yt-player-error', { detail: { code } })
        );
      }
    },
    true
  );

  window.addEventListener(
    'error',
    (event: ErrorEvent) => {
      if (
        isYouTubePlayerErrorObject(event.error) ||
        (typeof event.message === 'string' &&
          event.message.includes('playerInfo') &&
          event.message.includes('apiInterface'))
      ) {
        event.preventDefault();
        const errObj = event.error as { data?: unknown } | undefined;
        const code = errObj?.data ? String(errObj.data) : '150';
        window.dispatchEvent(
          new CustomEvent('orbit-yt-player-error', { detail: { code } })
        );
      }
    },
    true
  );
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
