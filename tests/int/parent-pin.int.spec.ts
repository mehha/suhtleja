import { describe, expect, it } from 'vitest'

import { pinChangeNeedsPassword } from '@/utilities/parentPin'

describe('pinChangeNeedsPassword', () => {
  it('lets the parent view change the PIN without the password', () => {
    expect(pinChangeNeedsPassword({ hasPin: true, isParentMode: true })).toBe(false)
  })

  it('asks for the account password in the child view, so a child cannot set their own PIN', () => {
    expect(pinChangeNeedsPassword({ hasPin: true, isParentMode: false })).toBe(true)
  })

  it('lets anyone set a first PIN when none is set, since there is no lock yet', () => {
    expect(pinChangeNeedsPassword({ hasPin: false, isParentMode: false })).toBe(false)
  })
})
