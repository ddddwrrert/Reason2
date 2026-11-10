/**
 * Tip holdout gate: new best must pass retests before becoming incumbent tip.
 *
 * Hard rules:
 * - Official V only (fitness from sealed evaluate)
 * - Hard budget B owned by evolve.context().budget
 * - Uncertain ≠ down
 */

import { tipHash } from './hash.js'

/**
 * @param {object} tips
 * @returns {object|null}
 */
export function currentIncumbent(tips) {
  return tips?.incumbent ?? null
}

/**
 * @param {object|null} incumbent
 * @param {number} fitness
 * @param {number} [eps=0]
 */
export function beatsIncumbent(incumbent, fitness, eps = 0) {
  if (!incumbent || typeof incumbent.fitness !== 'number') return true
  return fitness > incumbent.fitness + eps
}

/**
 * Ensure tips shape.
 * @param {object} tips
 */
export function ensureTips(tips) {
  if (!tips.incumbent) tips.incumbent = null
  if (!Array.isArray(tips.holdouts)) tips.holdouts = []
  if (!tips.pending) tips.pending = null
  return tips
}

/**
 * Offer a candidate as tip pending holdout retests.
 * @param {object} tips
 * @param {object} candidate
 * @param {object} cfg
 */
export function offerTip(tips, candidate, cfg = {}) {
  ensureTips(tips)
  const eps = cfg.tip_holdout_eps ?? 0
  if (!beatsIncumbent(tips.incumbent, candidate.fitness, eps)) {
    return { status: 'rejected_not_better', tips }
  }

  const hash = tipHash({
    child_id: candidate.child_id,
    fitness: candidate.fitness,
    locus: candidate.locus,
    parent_id: candidate.parent_id,
  })

  const need = Math.max(0, Number(cfg.tip_holdout_retests ?? 1))
  if (need <= 0) {
    tips.incumbent = {
      tip_hash: hash,
      ...candidate,
      status: 'promoted',
    }
    tips.holdouts.push({ tip_hash: hash, child_id: candidate.child_id, fitness: candidate.fitness, status: 'promoted', step: candidate.step })
    tips.pending = null
    return { status: 'promoted', tip_hash: hash, tips }
  }

  tips.pending = {
    tip_hash: hash,
    ...candidate,
    need,
    passed: 0,
    status: 'pending_holdout',
  }
  tips.holdouts.push({
    tip_hash: hash,
    child_id: candidate.child_id,
    fitness: candidate.fitness,
    status: 'pending_holdout',
    step: candidate.step,
  })
  return { status: 'pending_holdout', tip_hash: hash, tips }
}

/**
 * Record one holdout retest against pending tip.
 * Offline: retest "passes" if fitness stays >= pending.fitness - eps.
 * @param {object} tips
 * @param {number} retestFitness
 * @param {object} cfg
 */
export function retestPendingTip(tips, retestFitness, cfg = {}) {
  ensureTips(tips)
  if (!tips.pending) return { status: 'no_pending', tips }
  const eps = cfg.tip_holdout_eps ?? 0
  const ok = retestFitness + eps >= tips.pending.fitness
  if (!ok) {
    tips.pending.status = 'rejected_holdout'
    tips.holdouts.push({
      tip_hash: tips.pending.tip_hash,
      child_id: tips.pending.child_id,
      fitness: retestFitness,
      status: 'rejected_holdout',
    })
    tips.pending = null
    return { status: 'rejected_holdout', tips }
  }

  tips.pending.passed += 1
  if (tips.pending.passed >= tips.pending.need) {
    tips.incumbent = {
      tip_hash: tips.pending.tip_hash,
      child_id: tips.pending.child_id,
      parent_id: tips.pending.parent_id,
      fitness: tips.pending.fitness,
      locus: tips.pending.locus,
      arm: tips.pending.arm,
      step: tips.pending.step,
      status: 'promoted',
    }
    tips.holdouts.push({
      tip_hash: tips.pending.tip_hash,
      child_id: tips.pending.child_id,
      fitness: tips.pending.fitness,
      status: 'promoted',
    })
    tips.pending = null
    return { status: 'promoted', tips }
  }
  return { status: 'pending_holdout', tips }
}
