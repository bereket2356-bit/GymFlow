import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(_error, _errorInfo) {
    // Intentionally no stack trace or dev error output shown to users
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "var(--bg-app, #0f1117)",
            color: "var(--text-main, #f0f2f5)",
            fontFamily: "var(--font-sans, sans-serif)",
          }}
        >
          <div
            style={{
              maxWidth: "420px",
              width: "100%",
              textAlign: "center",
              background: "var(--bg-card, #181b24)",
              border: "1px solid var(--border-subtle, #272c3d)",
              borderRadius: "12px",
              padding: "32px 24px",
            }}
          >
            <h1
              style={{
                fontSize: "20px",
                fontWeight: 600,
                marginBottom: "8px",
                color: "var(--text-main, #f0f2f5)",
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                fontSize: "14px",
                color: "var(--text-muted, #8b92a5)",
                lineHeight: 1.5,
                marginBottom: "24px",
              }}
            >
              An unexpected error occurred while running the console. Reload the page to continue.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="btn btn-primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px 20px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Reload application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
