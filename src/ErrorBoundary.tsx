import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('今日ノートでエラーが発生しました', error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-error">
          <img src="/icon-192x192.png" alt="" />
          <h1>画面を表示できませんでした</h1>
          <p>保存済みのデータはそのままです。ページを再読み込みしてください。</p>
          {import.meta.env.DEV && this.state.message && <details><summary>開発用の詳細</summary><code>{this.state.message}</code></details>}
          <button className="button button--primary" onClick={() => window.location.reload()}>再読み込み</button>
        </main>
      );
    }
    return this.props.children;
  }
}
