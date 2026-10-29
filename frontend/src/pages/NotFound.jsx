import { Link } from "react-router-dom";

/** Unknown route: a short message and a way back to the dashboard. */
export default function NotFound() {
  return (
    <>
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">Page not found</h1>
          <p className="page-meta">That address doesn’t exist in this console.</p>
        </div>
      </div>
      <div className="empty-state">
        <p>Nothing to show here. Go back to the dashboard to pick up where you left off.</p>
        <div className="hstack">
          <Link className="btn btn-sm btn-primary" to="/">Back to dashboard</Link>
        </div>
      </div>
    </>
  );
}