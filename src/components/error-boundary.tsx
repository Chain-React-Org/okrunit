"use client";

import React, { Component } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global React error boundary that captures component crashes and
 * reports them to the error monitoring system via the client capture API.
 */
export class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Report to error monitoring system
    fetch("/api/v1/admin/errors/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: typeof window !== "undefined" ? window.location.href : undefined,
        errorType: error.name,
      }),
    }).catch(() => {
      // Swallow. Error reporting must not cause more errors
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center text-center px-4">
          <div className="rounded-xl bg-red-50 dark:bg-red-950/30 p-4 mb-4">
            <AlertTriangle className="size-8 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold mb-1">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            An unexpected error occurred. The issue has been automatically reported to our team.
          </p>
          <Button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            Reload page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
