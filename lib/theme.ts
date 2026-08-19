export const colors = {
  primary: '#2563eb',
  danger: '#dc2626',
  success: '#16a34a',
  text: '#333',
  textMuted: '#666',
  textFaint: '#888',
  border: '#eee',
  borderInput: '#ddd',
  backgroundMuted: '#f1f1f1',
} as const;

// Dark palette for the app shell chrome (header/tab bar) and the Dashboard
// screen. Not yet applied to every screen's own content -- see the
// FitFlex Roadmap memory notes for the plan to extend this further.
export const dark = {
  background: '#0a0a0a',
  surface: '#161616',
  surfaceElevated: '#1e1e1e',
  accent: '#a3e635',
  accentDark: '#65a30d',
  text: '#ffffff',
  textMuted: '#a1a1aa',
  textFaint: '#71717a',
  border: '#2a2a2a',
  danger: '#f87171',
} as const;
