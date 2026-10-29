/** Inline SVG icon set ported from the prototype. All strokes use currentColor. */
const ICONS = {
  dashboard: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
    </>
  ),
  customers: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c.5-3.6 2.6-5.4 5.5-5.4s5 1.8 5.5 5.4" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 14.9c2 .6 3.2 2.3 3.5 5.1" />
    </>
  ),
  package: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9M8 5.25l8 4.5" />
    </>
  ),
  attendance: (
    <>
      <rect x="4.5" y="4.5" width="15" height="16" rx="1.5" />
      <path d="M8.5 3v3M15.5 3v3M8.5 11h7M8.5 15h4" />
      <path d="m8.5 18 1.4 1.4L13 16" />
    </>
  ),
  reports: (
    <>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16v-4M12 16V7M16 16v-6M20 16V9" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h6M14 7h6M4 17h10M18 17h2" />
      <circle cx="12" cy="7" r="2" />
      <circle cx="16" cy="17" r="2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  card: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
      <path d="M3 9.5h18M6.5 14.5h4" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="1.5" />
      <path d="M8 3v4M16 3v4M4 9.5h16" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 4.5 4.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="1.5" />
      <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  signout: <path d="M14 5H6v14h8M10.5 12H21M18 8.5 21 12l-3 3.5" />,
  check: <path d="m5 12.5 4.5 4.5L19 6.5" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 10.5V17M12 7.6v.2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
  monitor: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="1.5" />
      <path d="M9 20h6M12 16.5V20" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c.5-3.6 2.6-5.4 5.5-5.4s5 1.8 5.5 5.4" />
    </>
  ),
};

export default function Icon({ name, className = "" }) {
  const paths = ICONS[name];
  if (!paths) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {paths}
    </svg>
  );
}

export const BRAND_MARK = (
  <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <path d="M6 9.5h20M6 15.5h20M6 21.5h20" stroke="var(--accent)" strokeWidth="1.1" opacity=".5" />
    <path d="M10 26 23 6" stroke="var(--accent)" strokeWidth="2.2" />
    <path d="M6 4.5v23" stroke="var(--border)" strokeWidth="1" />
  </svg>
);