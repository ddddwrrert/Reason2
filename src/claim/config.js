/**
 * Reason2 claim config (persisted under run/claim/config.json).
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { claimPaths } from './paths.js'

/** @returns {object} */
export function defaultConfig() {
  return {
    explore_rate: 0.35,
    starve_ratio: 0.5,
    r_minus_cap: 32,
    r_plus_cap: 48,
    r_minus_decay: 0.15,
    tip_holdout_retests: 1,
    tip_holdout_eps: 0,
    seed: null,
  }
}

/**
 * @param {string} runRoot
 * @param {object} [overrides]
 */
export async function loadConfig(runRoot, overrides = {}) {
  const paths = claimPaths(runRoot)
  await mkdir(paths.root, { recursive: true })
  let saved = {}
  try {
    saved = JSON.parse(await readFile(paths.config, 'utf8'))
  } catch {
    saved = {}
  }
  const cleaned = Object.fromEntries(
    Object.entries(overrides).filter(([, v]) => v !== undefined && v !== null && !Number.isNaN(v)),
  )
  const cfg = { ...defaultConfig(), ...saved, ...cleaned }
  await writeFile(paths.config, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8')
  return cfg
}
