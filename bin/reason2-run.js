#!/usr/bin/env node
/**
 * Reason2 standalone runner (independent; no DSH required).
 */

import { mkdir, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStandaloneEvolve } from '../src/standalone/harness.js'
import { run as reasonLoop } from '../src/providers/claim-loop.js'
import { run as baselineLoop } from '../src/baseline/loop.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function parseArgs(argv) {
  const out = {
    mode: 'reason',
    budget: 6,
    task: join(root, 'tasks', 'demo'),
    run: join(root, 'run'),
    clean: false,
    tipHoldoutRetests: 1,
    exploreRate: undefined,
  }
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--mode') out.mode = argv[++i]
    else if (a === '--budget') out.budget = Number(argv[++i])
    else if (a === '--task') out.task = resolve(argv[++i])
    else if (a === '--run') out.run = resolve(argv[++i])
    else if (a === '--clean') out.clean = true
    else if (a === '--tip-holdout') out.tipHoldoutRetests = Number(argv[++i])
    else if (a === '--explore-rate') out.exploreRate = Number(argv[++i])
    else if (a === '--help' || a === '-h') out.help = true
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help) {
    console.log(`Reason2 standalone runner

Usage:
  npm start
  node bin/reason2-run.js [--mode reason|baseline] [--budget N] [--task DIR] [--run DIR] [--clean]
                          [--tip-holdout N] [--explore-rate P]
`)
    return
  }

  if (args.clean) await rm(args.run, { recursive: true, force: true })
  await mkdir(args.run, { recursive: true })

  const mode = args.mode === 'baseline' ? 'baseline' : 'reason'
  const { evolve, init } = createStandaloneEvolve({
    taskDir: args.task,
    runRoot: args.run,
    maxBudget: args.budget,
    mode,
  })
  await init()

  const loop = mode === 'baseline' ? baselineLoop : reasonLoop
  console.log(`[reason2-run] mode=${mode} budget=${args.budget}`)
  const result = await loop({
    tipHoldoutRetests: args.tipHoldoutRetests,
    exploreRate: args.exploreRate,
  }, evolve)
  console.log('[reason2-run] result', result)
  if (mode === 'reason') console.log(`[reason2-run] claim ledger: ${join(args.run, 'claim')}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
