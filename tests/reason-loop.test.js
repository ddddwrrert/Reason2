import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { createStandaloneEvolve } from '../src/standalone/harness.js'
import { run as reasonLoop } from '../src/providers/claim-loop.js'
import { run as baselineLoop } from '../src/baseline/loop.js'
import { claimPaths } from '../src/claim/paths.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const task = join(root, 'tasks', 'demo')
/** @type {string[]} */
const temps = []

afterEach(async () => {
  while (temps.length) await rm(temps.pop(), { recursive: true, force: true })
})

async function freshRun(mode, budget = 5) {
  const runRoot = await mkdtemp(join(tmpdir(), `reason2-${mode}-`))
  temps.push(runRoot)
  const { evolve, init } = createStandaloneEvolve({
    taskDir: task, runRoot, maxBudget: budget, mode,
  })
  await init()
  return { evolve, runRoot }
}

describe('reason2-loop standalone', () => {
  it('runs and writes claim ledger + config + report', async () => {
    const { evolve, runRoot } = await freshRun('reason', 5)
    const result = await reasonLoop({ exploreRate: 0.4, tipHoldoutRetests: 1 }, evolve)
    expect(result.best_id).toMatch(/^c\d+$/)
    expect(result.remaining).toBe(0)

    const paths = claimPaths(runRoot)
    const events = await readFile(paths.events, 'utf8')
    expect(events.trim().split('\n').length).toBeGreaterThanOrEqual(1)
    const evt = JSON.parse(events.trim().split('\n')[0])
    expect(evt.claim_text).toBeTruthy()
    expect(Array.isArray(evt.themes)).toBe(true)

    const cfg = JSON.parse(await readFile(paths.config, 'utf8'))
    expect(cfg.explore_rate).toBeDefined()
    const report = JSON.parse(await readFile(paths.report, 'utf8'))
    expect(report.mode).toBe('reason2')
  })

  it('baseline mode still runs', async () => {
    const { evolve } = await freshRun('baseline', 3)
    const result = await baselineLoop({}, evolve)
    expect(result.remaining).toBe(0)
  })
})
