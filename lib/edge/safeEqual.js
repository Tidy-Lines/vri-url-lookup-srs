// Constant-time-ish string comparison (Edge runtime safe)
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  // Always iterate over the max length; length diff influences mismatch
  let mismatch = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ca = a.charCodeAt(i) || 0;
    const cb = b.charCodeAt(i) || 0;
    mismatch |= (ca ^ cb);
  }
  return mismatch === 0;
}
