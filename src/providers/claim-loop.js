/**
 * Reason2 loop — Claim arm with real locus plan, tip holdout, config.
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { alive, merit } from '../population.js'
import { chooseArm } from '../claim/arm.js'
import { attributeAndCommit } from '../claim/attribute.js'
import { loadLedger, claimsForLocus } from '../claim/ledger.js'
import { loadConfig } from '../claim/config.js'
import { planLocus } from '../claim/locus.js'
import { planClaimText } from '../claim/prompt.js'
import { claimPaths } from '../claim/paths.js'

export const name = 'reason2-loop'

/**
 * @param {object} args
 * @param {object} evolve
 */
export async function run(args, evolve) {
  const { maxPopulation, candidates } = await evolve.context()
  const population = evolve.population()
  const runState = evolve.currentRun()
  const runRoot = evolve.runRoot ?? evolve.files?.root

  const cfg = runRoot
    ? await loadConfig(runRoot, {
      explore_rate: args?.exploreRate,
      starve_ratio: args?.starveRatio,
      tip_holdout_retests: args?.tipHoldoutRetests,
      seed: args?.seed ?? null,
    })
    : {}

  let rows = await population.rows()
  if (rows.length === 0) {
    const base = await evolve.copyTask()
    const baseFitness = await evolve.evaluate(base)
    await population.append({
      id: base.id,
      parent: null,
      fitness: baseFitness,
      survival: 'yes',
      claim: { locus: 'repair', arm: 'exploit', outcome: 'uncertain' },
    })
    rows = await population.rows()
  }

  const limit = candidates ?? Infinity
  let created = 0
  let lastTip = null

  while ((await evolve.context()).budget.remaining > 0 && created < limit) {
    runState.signal.throwIfAborted()

    const state = runRoot ? await loadLedger(runRoot) : null
    const armPick = state
      ? chooseArm(state, {
        exploreRate: cfg.explore_rate,
        starveRatio: cfg.starve_ratio,
        rng: args?.rng,
      })
      : { arm: 'exploit', reason: 'no_ledger', locusHint: null }

    const locus = planLocus(state, armPick.arm, armPick.locusHint)
    const pack = state ? claimsForLocus(state, locus) : { plus: [], minus: [] }
    const claim_text = planClaimText(locus, armPick.arm, pack)

    evolve._reasonDecision = {
      arm: armPick.arm,
      reason: armPick.reason,
      locus,
      claim_text,
      plan: claim_text,
      plus: pack.plus,
      minus: pack.minus,
    }

    const parentId = await evolve.select(population)
    rows = await population.rows()
    const parentRow = rows.find(r => r.id === parentId)
    const parentFitness = typeof parentRow?.fitness === 'number' ? parentRow.fitness : undefined

    const candidate = await evolve.mutate({
      parent: parentId,
      parentFitness,
      claim: evolve._reasonDecision,
    })
    created += 1

    const fitness = await evolve.evaluate(candidate)

    let claimMeta = {
      arm: evolve._reasonDecision.arm,
      locus,
      claim_text,
      outcome: 'uncertain',
      tip_hash: null,
    }

    try {
      claimMeta = {
        ...claimMeta,
        ...(await attributeAndCommit(evolve, {
          parent_id: parentId,
          child_id: candidate.id,
          fitness,
          parent_fitness: parentFitness,
          locus,
          arm: evolve._reasonDecision.arm,
          cfg,
        })),
      }
      lastTip = claimMeta.tip_hash
    } catch {
      /* never break sealed search */
    }

    await population.append({
      id: candidate.id,
      parent: parentId,
      fitness,
      survival: 'yes',
      claim: claimMeta,
    })

    rows = await population.rows()
    if (alive(rows).length >= maxPopulation) {
      await evolve.survive(population)
      rows = await population.rows()
    }

    delete evolve._reasonDecision
  }

  rows = await population.rows()
  let best = rows[0]
  for (const row of rows) {
    if (best === undefined || merit(row.fitness) > merit(best.fitness)) best = row
  }

  const budget = (await evolve.context()).budget
  const result = {
    best_id: best?.id ?? 'c000000',
    best_fitness: best?.fitness ?? 0,
    remaining: budget.remaining,
    claim: {
      tip_hash: lastTip ?? best?.claim?.tip_hash ?? null,
      events_dir: runRoot ? `${runRoot}/claim` : null,
      config: cfg,
    },
  }

  if (runRoot) {
    const paths = claimPaths(runRoot)
    await mkdir(paths.root, { recursive: true })
    await writeFile(paths.report, `${JSON.stringify({
      mode: 'reason2',
      budget_max: budget.max,
      remaining: budget.remaining,
      best_id: result.best_id,
      best_fitness: result.best_fitness,
      tip_hash: result.claim.tip_hash,
      created,
      config: cfg,
    }, null, 2)}\n`, 'utf8')
  }

  return result
}

export default { name, run }
