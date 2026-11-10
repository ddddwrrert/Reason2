import { describe, expect, it } from 'vitest'
import { diffThemes, executableClaims } from '../src/claim/diff.js'
import { locusFromThemes, refineLocus } from '../src/claim/locus.js'

describe('diffThemes + locus', () => {
  it('detects speed theme and maps locus', () => {
    const diff = diffThemes(
      'int score_hint = 1;',
      'int score_hint = 2;\n// cache hash fast prune',
    )
    expect(diff.themes).toContain('speed')
    expect(locusFromThemes(diff.themes)).toBe('speed')
  })

  it('builds executable up/down claims', () => {
    const diff = { added: ['int score_hint = 3;'], removed: [], themes: ['depth'] }
    expect(executableClaims(diff, 'up', 'depth')).toMatch(/Prefer edits/)
    expect(executableClaims(diff, 'down', 'depth')).toMatch(/Avoid repeating/)
  })

  it('refineLocus prefers planned when present', () => {
    expect(refineLocus('repair', ['speed', 'repair'])).toBe('repair')
    expect(refineLocus('repair', ['speed'])).toBe('speed')
  })
})
