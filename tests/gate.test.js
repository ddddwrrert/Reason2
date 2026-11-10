import { describe, expect, it } from 'vitest'
import { ensureTips, offerTip, retestPendingTip } from '../src/claim/gate.js'

describe('tip holdout gate', () => {
  it('promotes after required retests', () => {
    const tips = ensureTips({})
    const offered = offerTip(tips, {
      child_id: 'c1', parent_id: 'c0', fitness: 5, locus: 'repair', arm: 'exploit', step: 1,
    }, { tip_holdout_retests: 1 })
    expect(offered.status).toBe('pending_holdout')
    const done = retestPendingTip(tips, 5, { tip_holdout_retests: 1 })
    expect(done.status).toBe('promoted')
    expect(tips.incumbent.child_id).toBe('c1')
  })

  it('rejects failed holdout', () => {
    const tips = ensureTips({})
    offerTip(tips, {
      child_id: 'c1', parent_id: 'c0', fitness: 5, locus: 'repair', arm: 'exploit', step: 1,
    }, { tip_holdout_retests: 1 })
    const done = retestPendingTip(tips, 3, {})
    expect(done.status).toBe('rejected_holdout')
    expect(tips.incumbent).toBe(null)
  })
})
