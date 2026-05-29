import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100 p-6">
          <div className="max-w-md text-center space-y-4">
            <div className="text-6xl">⚠</div>
            <h1 className="text-2xl font-bold">Algo quebrou</h1>
            <p className="text-sm text-neutral-400">
              Um componente do app falhou. Você pode tentar continuar — o estado foi preservado.
            </p>
            <pre className="text-[10px] font-mono text-left bg-neutral-900 border border-neutral-800 rounded-lg p-3 overflow-auto max-h-40 text-red-300">
              {this.state.error.message}
            </pre>
            <div className="flex gap-2 justify-center">
              <button
                onClick={this.reset}
                className="px-4 py-2 rounded-lg bg-amber-400 text-neutral-950 font-bold text-sm hover:bg-amber-300"
              >
                Tentar continuar
              </button>
              <button
                onClick={() => location.reload()}
                className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-100 text-sm hover:bg-neutral-700 border border-neutral-700"
              >
                Recarregar app
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
