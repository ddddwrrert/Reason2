/**
 * Lightweight solution diff → edit themes (no LLM).
 * Used for locus inference and executable claim text.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * @param {string} parentText
 * @param {string} childText
 * @returns {{ added: string[], removed: string[], themes: string[] }}
 */
export function diffThemes(parentText, childText) {
  const parentLines = new Set(String(parentText).split(/\r?\n/))
  const childLines = String(childText).split(/\r?\n/)
  const added = []
  const removed = []
  const childSet = new Set(childLines)
  for (const line of childLines) {
    if (!parentLines.has(line) && line.trim()) added.push(line.trim())
  }
  for (const line of parentLines) {
    if (!childSet.has(line) && String(line).trim()) removed.push(String(line).trim())
  }

  const blob = `${added.join('\n')}\n${removed.join('\n')}`.toLowerCase()
  const themes = []
  const rules = [
    ['repair', /fix|bug|wrong|error|crash|nan|overflow|off[- ]?by|assert/],
    ['structure', /struct|class|refactor|rename|extract|module|interface|template/],
    ['depth', /dfs|bfs|recursion|search|dp|memo|depth|beam|backtrack/],
    ['speed', /fast|speed|cache|hash|O\(|complexity|prune|early.?stop|parallel/],
    ['io', /scanf|printf|cin|cout|input|output|readline/],
    ['numeric', /score_hint|double|float|int64|long long|mod\b|precision/],
  ]
  for (const [name, re] of rules) {
    if (re.test(blob)) themes.push(name)
  }
  if (themes.length === 0) {
    if (added.length || removed.length) themes.push('numeric')
    else themes.push('repair')
  }
  return { added: added.slice(0, 12), removed: removed.slice(0, 12), themes }
}

/**
 * @param {string} parentDir
 * @param {string} childDir
 * @param {string} [fileName='solution.cpp']
 */
export async function diffCandidateDirs(parentDir, childDir, fileName = 'solution.cpp') {
  let parentText = ''
  let childText = ''
  try { parentText = await readFile(join(parentDir, fileName), 'utf8') } catch { /* empty */ }
  try { childText = await readFile(join(childDir, fileName), 'utf8') } catch { /* empty */ }
  return diffThemes(parentText, childText)
}

/**
 * Build executable claim sentences from a diff + outcome.
 * @param {object} diff
 * @param {'up'|'down'|'uncertain'} outcome
 * @param {string} locus
 */
export function executableClaims(diff, outcome, locus) {
  const sampleAdd = (diff.added?.[0] ?? '').slice(0, 80)
  const sampleRem = (diff.removed?.[0] ?? '').slice(0, 80)
  if (outcome === 'up') {
    const bits = [`Prefer edits in locus=${locus}`]
    if (sampleAdd) bits.push(`Keep patterns like: ${sampleAdd}`)
    if (diff.themes?.length) bits.push(`Themes that helped: ${diff.themes.join(',')}`)
    return bits.join('. ')
  }
  if (outcome === 'down') {
    const bits = [`Avoid repeating locus=${locus} moves that lost score`]
    if (sampleAdd) bits.push(`Do not reintroduce: ${sampleAdd}`)
    if (sampleRem) bits.push(`Do not drop working lines like: ${sampleRem}`)
    return bits.join('. ')
  }
  return `Flat score on locus=${locus}; do not promote or ban yet`
}
