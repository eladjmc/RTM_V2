import AppProviders from './providers/AppProviders';
import AppRouter from './router/AppRouter';
import ErrorBoundary from './components/ErrorBoundary';
import DebugOverlay from './components/DebugOverlay';

export default function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <AppRouter />
        <DebugOverlay />
      </AppProviders>
    </ErrorBoundary>
  );
}
