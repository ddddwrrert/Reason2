/**
 * Reason2 select — locus-aware parent pick.
 */

import { alive, merit } from '../population.js'
import { loadLedger, pickExploitLocus, pickStarvedLocus } from '../claim/ledger.js'
import { DEFAULT_LOCI } from '../claim/paths.js'

export const name = 'reason2-select'

/**
 * @param {object} population
 * @param {object} evolve
 */
export async function select(population, evolve) {
  const rows = alive(await population.rows())
  if (rows.length === 0) throw new Error('reason2-select: empty population')

  const decision = evolve._reasonDecision
  const runRoot = evolve.runRoot ?? evolve.files?.root
  const state = runRoot ? await loadLedger(runRoot) : null

  const arm = decision?.arm ?? 'exploit'
  const locus = decision?.locus
    ?? (state
      ? (arm === 'explore' ? pickStarvedLocus(state) : pickExploitLocus(state))
      : DEFAULT_LOCI[0])

  const matched = rows.filter(r => r.claim?.locus === locus)
  const pool = matched.length > 0 ? matched : rows

  if (arm === 'explore') {
    const ranked = [...pool].sort((a, b) => {
      const va = a.claim?.locus_visits ?? 0
      const vb = b.claim?.locus_visits ?? 0
      if (va !== vb) return va - vb
      return merit(b.fitness) - merit(a.fitness)
    })
    return ranked[0].id
  }

  let best = pool[0]
  for (const row of pool) {
    if (merit(row.fitness) > merit(best.fitness)) best = row
  }
  return best.id
}

export default { name, select }
