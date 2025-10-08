// src/components/common/ErrorBoundary.tsx
import React from "react";

type Props = { children: React.ReactNode; fallbackTitle?: string };
type State = { hasError: boolean; error?: Error; info?: React.ErrorInfo };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
    this.setState({ info });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          <div className="font-semibold mb-1">{this.props.fallbackTitle ?? "Panel error"}</div>
          <div className="mb-2">{this.state.error?.message}</div>
          {this.state.info?.componentStack && (
            <pre className="whitespace-pre-wrap text-xs text-red-600/80">
              {this.state.info.componentStack}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
