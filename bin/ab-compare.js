#!/usr/bin/env node
/**
 * Same-B A/B: baseline vs reason2 on the same mock task.
 * Writes run/ab/report.json — does NOT claim contest tip proof.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStandaloneEvolve } from '../src/standalone/harness.js'
import { run as reasonLoop } from '../src/providers/claim-loop.js'
import { run as baselineLoop } from '../src/baseline/loop.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function parseArgs(argv) {
  const out = { budget: 6, task: join(root, 'tasks', 'demo'), out: join(root, 'run', 'ab') }
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--budget') out.budget = Number(argv[++i])
    else if (a === '--task') out.task = resolve(argv[++i])
    else if (a === '--out') out.out = resolve(argv[++i])
  }
  return out
}

async function runMode(mode, task, runRoot, budget) {
  await rm(runRoot, { recursive: true, force: true })
  await mkdir(runRoot, { recursive: true })
  const { evolve, init } = createStandaloneEvolve({
    taskDir: task,
    runRoot,
    maxBudget: budget,
    mode: mode === 'baseline' ? 'baseline' : 'reason',
  })
  await init()
  const loop = mode === 'baseline' ? baselineLoop : reasonLoop
  return loop({ tipHoldoutRetests: 1 }, evolve)
}

async function main() {
  const args = parseArgs(process.argv)
  await mkdir(args.out, { recursive: true })
  const baseline = await runMode('baseline', args.task, join(args.out, 'baseline'), args.budget)
  const reason2 = await runMode('reason', args.task, join(args.out, 'reason2'), args.budget)
  const report = {
    protocol: 'same_B_mock_V',
    budget: args.budget,
    task: args.task,
    baseline: { best_id: baseline.best_id, best_fitness: baseline.best_fitness, remaining: baseline.remaining },
    reason2: {
      best_id: reason2.best_id,
      best_fitness: reason2.best_fitness,
      remaining: reason2.remaining,
      tip_hash: reason2.claim?.tip_hash ?? null,
    },
    delta_fitness: reason2.best_fitness - baseline.best_fitness,
    note: 'Mock V only. Not an AHC tip proof.',
  }
  await writeFile(join(args.out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(report, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
