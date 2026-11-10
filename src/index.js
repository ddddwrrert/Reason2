/**
 * dsh-evolve-reason2 — independent Claim arm (standalone + optional DSH).
 * Opt-in via DSH_EVOLVE_REASON2=1. Does not edit upstream evolve-loop.
 *
 * @module dsh-evolve-reason2
 */

import { installReasonProviders, requested } from './install.js'

export const name = 'dsh-evolve-reason2'
export const inject = ['evolve']

export function apply(ctx) {
  if (!requested()) return
  const evolve = ctx.evolve
  ctx.effect(() => installReasonProviders(evolve).dispose)
}

export { requested, ENV_FLAG, installReasonProviders, installReason2Providers } from './install.js'
export { createStandaloneEvolve } from './standalone/harness.js'
