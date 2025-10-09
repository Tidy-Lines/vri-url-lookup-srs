// Load the list of "core" URL fragments from /coreUrls.json
// and categorize a URL as "core" if it includes any of them (case-insensitive).

// Import JSON as a module (Edge-compatible in Vercel)
import coreModule from '../data/coreUrls.json' assert { type: 'json' };

const CORE_FRAGMENTS = Array.isArray(coreModule)
  ? coreModule
  : coreModule?.default || [];

export async function loadCoreFragments() {
  // keep async to match previous call sites
  return CORE_FRAGMENTS;
}

export function categorizeByCore(loc, fragments) {
  const urlLower = (loc || '').toLowerCase();
  for (const frag of fragments) {
    if (frag && urlLower.includes(String(frag).toLowerCase())) return 'core';
  }
  return 'specific';
}
