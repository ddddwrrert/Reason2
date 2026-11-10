/**
 * Locus inference from diff themes + ledger pressure.
 */

import { DEFAULT_LOCI } from './paths.js'
import { pickExploitLocus, pickStarvedLocus } from './ledger.js'

/**
 * Map theme list → primary locus (must be in DEFAULT_LOCI or extended).
 * @param {string[]} themes
 * @param {string[]} [allowed]
 */
export function locusFromThemes(themes, allowed = DEFAULT_LOCI) {
  for (const t of themes || []) {
    if (allowed.includes(t)) return t
  }
  // map extended themes onto defaults
  const map = { io: 'repair', numeric: 'depth' }
  for (const t of themes || []) {
    if (map[t] && allowed.includes(map[t])) return map[t]
  }
  return allowed[0]
}

/**
 * Choose planned locus before mutate (arm-aware).
 * @param {object} state
 * @param {'exploit'|'explore'} arm
 * @param {string|null} hint
 */
export function planLocus(state, arm, hint = null) {
  if (hint && DEFAULT_LOCI.includes(hint)) return hint
  if (!state) return 'repair'
  return arm === 'explore' ? pickStarvedLocus(state) : pickExploitLocus(state)
}

/**
 * After mutate+evaluate, refine locus from actual diff (for attribution).
 * Prefer planned locus if it appears in themes; else first theme locus.
 * @param {string} planned
 * @param {string[]} themes
 */
export function refineLocus(planned, themes) {
  if (themes?.includes(planned)) return planned
  return locusFromThemes(themes)
}
