import { Component, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { STORAGE_PREFIX } from "../prefs";

type Props = {
  // Saved-state keys owned by the tool, without the storage prefix.
  storageKeys: (key: string) => boolean;
  labels: { title: string; body: string; retry: string; reset: string };
  children: ReactNode;
};

// One failing tool must not blank the whole app, and a saved draft that
// triggers the failure must not bring it back on every reload.
export class ToolBoundary extends Component<
  Props,
  { failed: boolean; round: number }
> {
  state = { failed: false, round: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  private retry = () =>
    this.setState((s) => ({ failed: false, round: s.round + 1 }));

  private reset = () => {
    try {
      Object.keys(localStorage)
        .filter(
          (k) =>
            k.startsWith(STORAGE_PREFIX) &&
            this.props.storageKeys(k.slice(STORAGE_PREFIX.length)),
        )
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
    this.retry();
  };

  render() {
    const { labels } = this.props;
    if (!this.state.failed)
      return (
        <ToolRound key={this.state.round}>{this.props.children}</ToolRound>
      );
    return (
      <div className="tool-failed" role="alert">
        <TriangleAlert size={18} strokeWidth={1.75} aria-hidden="true" />
        <div>
          <strong>{labels.title}</strong>
          <p>{labels.body}</p>
          <div className="tool-failed-actions">
            <button type="button" className="btn primary" onClick={this.retry}>
              {labels.retry}
            </button>
            <button type="button" className="btn" onClick={this.reset}>
              {labels.reset}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

// Remounts the tool after a retry so it starts from fresh state.
function ToolRound({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
