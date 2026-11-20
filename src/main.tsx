import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerAutoUpdateServiceWorker } from './utils/swCacheManager';

registerAutoUpdateServiceWorker();

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Erreur inattendue de rendu React.',
    };
  }

  private handleResetSession = () => {
    try {
      localStorage.removeItem('autopro_license_session');
      sessionStorage.removeItem('autopro_admin_passcode');
    } catch {
      // Ignore storage errors
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            backgroundColor: '#070b14',
            color: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '520px',
              width: '100%',
              backgroundColor: '#0f172a',
              border: '1px solid #dc2626',
              borderRadius: '16px',
              padding: '24px',
            }}
          >
            <h2 style={{ margin: '0 0 8px', fontSize: '18px', color: '#fca5a5' }}>
              Récupération Interface AutoPro Hub
            </h2>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>
              Une erreur d&apos;affichage a été interceptée pour éviter un écran blanc :
            </p>
            <pre
              style={{
                backgroundColor: '#020617',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '10px',
                fontSize: '11px',
                color: '#f87171',
                overflowX: 'auto',
                marginBottom: '16px',
              }}
            >
              {this.state.errorMessage}
            </pre>
            <button
              type="button"
              onClick={this.handleResetSession}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#06b6d4',
                color: '#020617',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Réinitialiser la session &amp; Recharger
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootEl = document.getElementById('root')!;
createRoot(rootEl).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
