import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: 16,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <h2>Something went wrong</h2>
          <p style={{ color: '#888' }}>An unexpected error occurred.</p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            style={{
              padding: '8px 24px',
              fontSize: 16,
              borderRadius: 8,
              border: '1px solid #ccc',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
