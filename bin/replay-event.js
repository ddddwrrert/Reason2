#!/usr/bin/env node
/**
 * Replay / inspect a claim event from run/claim/events.jsonl
 *
 *   node bin/replay-event.js --run ./run --step 3
 *   node bin/replay-event.js --run ./run --last
 */

import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { claimPaths } from '../src/claim/paths.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function parseArgs(argv) {
  const out = { run: join(root, 'run'), step: null, last: false }
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--run') out.run = resolve(argv[++i])
    else if (a === '--step') out.step = Number(argv[++i])
    else if (a === '--last') out.last = true
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv)
  const paths = claimPaths(args.run)
  const raw = await readFile(paths.events, 'utf8')
  const events = raw.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
  if (events.length === 0) {
    console.error('no events')
    process.exit(2)
  }
  let event
  if (args.last || args.step == null) event = events[events.length - 1]
  else event = events.find(e => e.step === args.step) ?? events[args.step - 1]
  if (!event) {
    console.error('event not found')
    process.exit(2)
  }
  console.log(JSON.stringify({
    event,
    replay: {
      arm: event.arm,
      locus: event.locus,
      planned_locus: event.planned_locus,
      outcome: event.outcome,
      claim_text: event.claim_text,
      themes: event.themes,
      tip_hash: event.tip_hash,
      tip_pending: event.tip_pending,
    },
  }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
