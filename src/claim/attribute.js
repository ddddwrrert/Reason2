/**
 * Post-evaluate attribution with diff-based executable claims + tip gate.
 */

import { join } from 'node:path'
import {
  applyAttribution,
  appendEvent,
  classifyOutcome,
  loadLedger,
  saveLedger,
} from './ledger.js'
import { diffCandidateDirs, executableClaims } from './diff.js'
import { refineLocus } from './locus.js'
import { loadConfig } from './config.js'

/**
 * @param {object} evolve
 * @param {object} step
 */
export async function attributeAndCommit(evolve, step) {
  const runRoot = evolve.runRoot ?? evolve.files?.root
  if (!runRoot) throw new Error('attributeAndCommit: missing evolve.runRoot')

  const cfg = await loadConfig(runRoot, step.cfg ?? {})
  const outcome = classifyOutcome(step.fitness, step.parent_fitness)

  const parentDir = join(runRoot, 'candidates', step.parent_id)
  const childDir = join(runRoot, 'candidates', step.child_id)
  let diff = { added: [], removed: [], themes: [step.locus] }
  try {
    diff = await diffCandidateDirs(parentDir, childDir)
  } catch {
    /* keep planned */
  }

  const locus = refineLocus(step.locus, diff.themes)
  const claim_text = step.claim_text_override
    ?? executableClaims(diff, outcome, locus)

  const state = await loadLedger(runRoot)
  applyAttribution(state, {
    ...step,
    locus,
    outcome,
    claim_text,
    themes: diff.themes,
  }, cfg)
  await saveLedger(runRoot, state)

  const event = {
    t: new Date().toISOString(),
    step: state.step,
    parent_id: step.parent_id,
    child_id: step.child_id,
    fitness: step.fitness,
    parent_fitness: step.parent_fitness,
    locus,
    planned_locus: step.locus,
    arm: step.arm,
    outcome,
    claim_text,
    themes: diff.themes,
    added: diff.added.slice(0, 5),
    removed: diff.removed.slice(0, 5),
    tip_hash: state.tips?.incumbent?.tip_hash ?? null,
    tip_pending: state.tips?.pending?.tip_hash ?? null,
    tip_status: state.tips?.incumbent?.status ?? state.tips?.pending?.status ?? null,
  }
  await appendEvent(runRoot, event)

  return {
    outcome,
    claim_text,
    tip_hash: state.tips?.incumbent?.tip_hash ?? null,
    tip_pending: state.tips?.pending?.tip_hash ?? null,
    locus,
    themes: diff.themes,
    arm: step.arm,
  }
}
