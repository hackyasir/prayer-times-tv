import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Keep the error in console for kiosk diagnostics, but keep the UI alive.
    console.error('Dashboard render error', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: '2rem',
            textAlign: 'center',
            background: 'var(--t-bg)',
            color: 'var(--t-text)',
            fontFamily: 'Rajdhani, sans-serif',
          }}
        >
          <div style={{ maxWidth: '36rem' }}>
            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', marginBottom: '1rem' }}>
              Dashboard error
            </h1>
            <p style={{ fontSize: '1.1rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Something went wrong while rendering the display. Reload the page to recover.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre
                style={{
                  textAlign: 'left',
                  whiteSpace: 'pre-wrap',
                  padding: '1rem',
                  marginBottom: '1.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(0, 0, 0, 0.35)',
                  color: 'var(--t-text-dim)',
                }}
              >
                {this.state.error.message}
              </pre>
            )}
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                background: 'var(--t-accent)',
                color: 'var(--t-bg)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '0.8rem 1.5rem',
                fontFamily: 'Rajdhani, sans-serif',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Reload display
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}