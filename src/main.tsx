import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { initServiceWorker } from './lib/registerServiceWorker';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class RootErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            backgroundColor: '#0A0A0A',
            color: '#F5F5F5',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: 'Inter, system-ui, sans-serif',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              maxWidth: '420px',
              backgroundColor: '#141414',
              border: '1px solid #2B2B2B',
              borderRadius: '20px',
              padding: '24px',
            }}
          >
            <h2 style={{ color: '#D97757', fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
              Ocorreu um erro ao carregar o aplicativo
            </h2>
            <p style={{ color: '#A3A3A3', fontSize: '12px', marginBottom: '16px', wordBreak: 'break-word' }}>
              {this.state.errorMessage}
            </p>
            <button
              onClick={() => {
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then((regs) => {
                    regs.forEach((r) => r.unregister());
                  });
                }
                window.location.reload();
              }}
              style={{
                backgroundColor: '#D97757',
                color: '#0A0A0A',
                border: 'none',
                borderRadius: '12px',
                padding: '10px 20px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

initServiceWorker();

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  );
}