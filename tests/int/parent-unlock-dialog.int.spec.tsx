import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ParentUnlockDialog } from '@/app/(frontend)/kodu/ParentUnlockDialog'

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }))

afterEach(cleanup)

const open = (hasPin: boolean) => {
  render(<ParentUnlockDialog hasPin={hasPin}>Vanema vaade</ParentUnlockDialog>)
  fireEvent.click(screen.getByRole('button', { name: 'Vanema vaade' }))
  return screen.getByRole('dialog', { name: 'Avan vanema vaate' })
}

describe('ParentUnlockDialog', () => {
  it('asks for the PIN and shows a parent who forgot it the way to the profile’s PIN card', () => {
    const dialog = open(true)
    expect(dialog.querySelector('input[data-input-otp]')).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Unustasid PIN-i?' }).getAttribute('href')).toBe('/profile#vanema-pin')
  })

  it('opens without a PIN too, to say why the parent view stays shut and where to set one', () => {
    const dialog = open(false)
    expect(dialog.textContent).toContain('Sellel kontol pole vanema PIN-i')
    expect(dialog.querySelector('input[data-input-otp]')).toBeNull()
    expect(screen.getByRole('link', { name: 'Sea PIN profiilis' }).getAttribute('href')).toBe('/profile#vanema-pin')
  })
})
