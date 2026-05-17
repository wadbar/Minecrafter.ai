import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-neutral-900/50 rounded-2xl border border-red-500/20 backdrop-blur-sm">
          <div className="p-4 bg-red-500/10 rounded-full mb-6">
            <AlertTriangle className="w-12 h-12 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Ops! Algo deu errado</h2>
          <p className="text-neutral-400 mb-8 max-w-md">
            Ocorreu um erro inesperado no sistema. Tentamos isolar a falha para não comprometer o restante da aplicação.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-3 bg-neutral-100 text-neutral-950 rounded-xl font-medium hover:bg-white transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Recarregar Aplicação
          </button>
          {import.meta.env.DEV && (
            <pre className="mt-8 p-4 bg-black/50 rounded-lg text-left text-xs text-red-400 overflow-auto max-w-full">
              {this.state.error?.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
