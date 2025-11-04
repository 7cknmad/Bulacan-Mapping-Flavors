import React from 'react';
import { XOctagon } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
          <div className="flex items-start gap-3">
            <XOctagon className="text-red-500 mt-0.5" size={20} />
            <div>
              <div className="font-semibold text-red-700 mb-1">Something went wrong</div>
              <div className="text-sm text-red-600">{this.state.error?.message}</div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}