// localStorage / sessionStorage that tolerate being blocked (private mode, etc.)
export function safeStorage(kind) {
  try {
    const s = kind === 'local' ? window.localStorage : window.sessionStorage;
    const probe = '__storage_test__';
    s.setItem(probe, probe);
    s.removeItem(probe);
    return s;
  } catch {
    return undefined;
  }
}
