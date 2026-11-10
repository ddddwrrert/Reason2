/**
 * Build claim blocks injected into mutate worker instructions (Reason2).
 */

/**
 * @param {object} ctx
 */
export function buildClaimBlock(ctx) {
  const { arm, locus, plus, minus, parentFitness, plan } = ctx
  const lines = [
    '--- REASON2 CLAIM CONTEXT (do not evaluate; improve one candidate) ---',
    `Arm: ${arm}`,
    `Planned locus: ${locus}`,
  ]
  if (plan) lines.push(`Plan: ${plan}`)
  if (typeof parentFitness === 'number' && Number.isFinite(parentFitness)) {
    lines.push(`Parent official fitness: ${parentFitness}`)
  }

  lines.push('', 'R+ (DO THESE — executable reinforces):')
  if (!plus?.length) lines.push('- (none yet; try a small coherent edit in the planned locus)')
  else for (const e of plus) lines.push(`- [${e.hits ?? 0}×] ${e.text}`)

  lines.push('', 'R- (DO NOT DO THESE — executable bans):')
  if (!minus?.length) lines.push('- (none yet)')
  else for (const e of minus) lines.push(`- [${e.hits ?? 0}×] ${e.text}`)

  lines.push(
    '',
    'Write one complete candidate. Uncertain outcomes are not bans. Do not run the official evaluator.',
    '--- END CLAIM CONTEXT ---',
  )
  return lines.join('\n')
}

/**
 * Planned claim text before mutate (executable intent).
 * @param {string} locus
 * @param {'exploit'|'explore'} arm
 * @param {{plus:object[],minus:object[]}} pack
 */
export function planClaimText(locus, arm, pack = { plus: [], minus: [] }) {
  const topPlus = pack.plus?.[0]?.text
  const topMinus = pack.minus?.[0]?.text
  if (arm === 'explore') {
    return `Explore locus=${locus}: try a new angle; avoid banned: ${topMinus || 'none'}`
  }
  return `Exploit locus=${locus}: amplify ${topPlus || `successful ${locus} edits`}; avoid ${topMinus || 'known failures'}`
}

/** @deprecated use planClaimText */
export function defaultClaimText(locus, arm) {
  return planClaimText(locus, arm)
}
