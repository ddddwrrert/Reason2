/**
 * Claim ledger: R+ / R- / loci / tips with capacity + decay (Reason2).
 */

import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { claimPaths, DEFAULT_LOCI } from './paths.js'
import { ensureTips, offerTip, retestPendingTip } from './gate.js'

/**
 * @returns {object}
 */
export function emptyState() {
  const loci = {}
  for (const id of DEFAULT_LOCI) {
    loci[id] = { visits: 0, ups: 0, downs: 0, uncertain: 0, last_arm: null }
  }
  return {
    r_plus: {},
    r_minus: {},
    loci,
    tips: ensureTips({}),
    step: 0,
  }
}

/**
 * @param {string} runRoot
 */
export async function loadLedger(runRoot) {
  const paths = claimPaths(runRoot)
  await mkdir(paths.root, { recursive: true })
  const state = emptyState()
  state.r_plus = await readJson(paths.rPlus, {})
  state.r_minus = await readJson(paths.rMinus, {})
  state.loci = { ...state.loci, ...(await readJson(paths.loci, {})) }
  state.tips = ensureTips({ ...state.tips, ...(await readJson(paths.tips, {})) })
  for (const id of DEFAULT_LOCI) {
    if (!state.loci[id]) {
      state.loci[id] = { visits: 0, ups: 0, downs: 0, uncertain: 0, last_arm: null }
    }
  }
  return state
}

/**
 * @param {string} runRoot
 * @param {object} state
 */
export async function saveLedger(runRoot, state) {
  const paths = claimPaths(runRoot)
  await mkdir(paths.root, { recursive: true })
  await writeFile(paths.rPlus, `${JSON.stringify(state.r_plus, null, 2)}\n`, 'utf8')
  await writeFile(paths.rMinus, `${JSON.stringify(state.r_minus, null, 2)}\n`, 'utf8')
  await writeFile(paths.loci, `${JSON.stringify(state.loci, null, 2)}\n`, 'utf8')
  await writeFile(paths.tips, `${JSON.stringify(state.tips, null, 2)}\n`, 'utf8')
}

/**
 * @param {string} runRoot
 * @param {object} event
 */
export async function appendEvent(runRoot, event) {
  const paths = claimPaths(runRoot)
  await mkdir(paths.root, { recursive: true })
  await appendFile(paths.events, `${JSON.stringify(event)}\n`, 'utf8')
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return fallback
  }
}

/**
 * @param {number} fitness
 * @param {number|undefined} parentFitness
 * @param {number} [eps=1e-9]
 */
export function classifyOutcome(fitness, parentFitness, eps = 1e-9) {
  if (typeof parentFitness !== 'number' || !Number.isFinite(parentFitness)) {
    return typeof fitness === 'number' && fitness > 0 ? 'up' : 'uncertain'
  }
  if (fitness > parentFitness + eps) return 'up'
  if (fitness < parentFitness - eps) return 'down'
  return 'uncertain'
}

/**
 * Trim map to cap by hits desc.
 * @param {object} map
 * @param {number} cap
 */
function trimMap(map, cap) {
  const entries = Object.entries(map)
  if (entries.length <= cap) return map
  entries.sort((a, b) => (b[1].hits ?? 0) - (a[1].hits ?? 0))
  return Object.fromEntries(entries.slice(0, cap))
}

/**
 * Apply R- decay then capacity trim.
 * @param {object} state
 * @param {object} cfg
 */
export function maintainClaims(state, cfg = {}) {
  const decay = cfg.r_minus_decay ?? 0.15
  for (const key of Object.keys(state.r_minus)) {
    const e = state.r_minus[key]
    e.hits = Math.max(0, (e.hits ?? 0) * (1 - decay))
    if (e.hits < 0.25) delete state.r_minus[key]
  }
  state.r_minus = trimMap(state.r_minus, cfg.r_minus_cap ?? 32)
  state.r_plus = trimMap(state.r_plus, cfg.r_plus_cap ?? 48)
  return state
}

/**
 * @param {object} state
 * @param {object} step
 * @param {object} [cfg]
 */
export function applyAttribution(state, step, cfg = {}) {
  const {
    locus,
    arm,
    outcome,
    claim_text,
    child_id,
    parent_id,
    fitness,
    parent_fitness,
    themes,
  } = step

  state.step = (state.step ?? 0) + 1
  ensureTips(state.tips)

  const loc = state.loci[locus] ?? {
    visits: 0, ups: 0, downs: 0, uncertain: 0, last_arm: null,
  }
  loc.visits += 1
  loc.last_arm = arm
  if (outcome === 'up') loc.ups += 1
  else if (outcome === 'down') loc.downs += 1
  else loc.uncertain += 1
  state.loci[locus] = loc

  const key = `${locus}::${claim_text || 'generic'}`

  if (outcome === 'up') {
    const entry = state.r_plus[key] ?? {
      locus, text: claim_text || 'generic', hits: 0, last_child: null, themes: themes ?? [],
    }
    entry.hits += 1
    entry.last_child = child_id
    entry.text = claim_text || entry.text
    entry.themes = themes ?? entry.themes
    state.r_plus[key] = entry
    if (state.r_minus[key]) {
      state.r_minus[key].hits = Math.max(0, (state.r_minus[key].hits ?? 1) - 1)
    }
  } else if (outcome === 'down') {
    const entry = state.r_minus[key] ?? {
      locus, text: claim_text || 'generic', hits: 0, last_child: null, themes: themes ?? [],
    }
    entry.hits += 1
    entry.last_child = child_id
    entry.text = claim_text || entry.text
    entry.themes = themes ?? entry.themes
    state.r_minus[key] = entry
  }

  // tip: offer on up that beats incumbent; also advance pending retest on any step
  if (outcome === 'up') {
    offerTip(state.tips, {
      child_id,
      parent_id,
      fitness,
      parent_fitness,
      locus,
      arm,
      step: state.step,
    }, cfg)
  }
  if (state.tips.pending && child_id !== state.tips.pending.child_id) {
    retestPendingTip(state.tips, fitness, cfg)
  }

  maintainClaims(state, cfg)
  return state
}

/**
 * @param {object} state
 * @param {string[]} [loci=DEFAULT_LOCI]
 */
export function pickStarvedLocus(state, loci = DEFAULT_LOCI) {
  let best = loci[0]
  let bestScore = Infinity
  for (const id of loci) {
    const loc = state.loci[id] ?? { visits: 0, ups: 0 }
    const score = (loc.visits ?? 0) * 100 - (loc.ups ?? 0)
    if (score < bestScore) {
      bestScore = score
      best = id
    }
  }
  return best
}

/**
 * @param {object} state
 * @param {string[]} [loci=DEFAULT_LOCI]
 */
export function pickExploitLocus(state, loci = DEFAULT_LOCI) {
  let best = loci[0]
  let bestScore = -1
  for (const id of loci) {
    const loc = state.loci[id] ?? { visits: 0, ups: 0 }
    const visits = loc.visits || 0
    const rate = visits === 0 ? 0 : (loc.ups ?? 0) / visits
    const score = rate * 10 + (loc.ups ?? 0)
    if (score > bestScore) {
      bestScore = score
      best = id
    }
  }
  return best
}

/**
 * @param {object} state
 * @param {string} locus
 * @param {number} [limit=3]
 */
export function claimsForLocus(state, locus, limit = 3) {
  const plus = Object.values(state.r_plus || {})
    .filter(e => e.locus === locus)
    .sort((a, b) => (b.hits ?? 0) - (a.hits ?? 0))
    .slice(0, limit)
  const minus = Object.values(state.r_minus || {})
    .filter(e => e.locus === locus)
    .sort((a, b) => (b.hits ?? 0) - (a.hits ?? 0))
    .slice(0, limit)
  return { plus, minus }
}
