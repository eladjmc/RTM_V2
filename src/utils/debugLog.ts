/** Global debug log buffer — importable from anywhere */
const MAX_LINES = 40;
export const _lines: string[] = [];
export const _listeners = new Set<() => void>();

export function debugLog(msg: string) {
  const ts = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  _lines.push(`[${ts}] ${msg}`);
  if (_lines.length > MAX_LINES) _lines.shift();
  _listeners.forEach((fn) => fn());
}
