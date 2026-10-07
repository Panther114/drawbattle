// The original reports usage events to a third-party analytics service.
// This clone keeps the same call sites but only exposes a local hook.
export function track(name, props) {
  if (typeof window !== 'undefined' && window.__dbTrack) window.__dbTrack(name, props);
}
