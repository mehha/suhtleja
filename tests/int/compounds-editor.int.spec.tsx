import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Compound } from '@/app/(frontend)/boards/[id]/compounds/applyCompounds'
import { CompoundsEditor } from '@/app/(frontend)/boards/[id]/compounds/CompoundsEditor'
import { COMPOUND_MISSING_WORD } from '@/app/(frontend)/boards/[id]/compounds/validateCompounds'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element, @typescript-eslint/no-unused-vars
  default: ({ fill, sizes, ...props }: Record<string, unknown>) => <img {...props} alt="" />,
}))
const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

const cards = [
  { id: 'c-kaks', title: 'kaks', imageURL: '/kaks.png' },
  { id: 'c-suur', title: 'suur', imageURL: null },
  { id: 'c-kass', title: 'kass', imageURL: '/kass.png' },
]

// Saved the way the old editor saved: the speech form repeats the word.
const kaksKassi: Compound = {
  id: 'kaks-kass',
  cells: [{ cellId: 'c-kaks' }, { cellId: 'c-kass' }],
  parts: [
    { surface: 'kaks', tts: 'kaks' },
    { surface: 'kassi', tts: 'kassi' },
  ],
}

const withRemovedCard: Compound = {
  id: 'removed',
  cells: [{ cellId: 'c-kaks' }, { cellId: 'c-pall' }],
  parts: [{ surface: 'kaks' }, { surface: 'palli' }],
}

function renderEditor(props: Partial<ComponentProps<typeof CompoundsEditor>> = {}) {
  const onSave = vi.fn().mockResolvedValue({ ok: true })
  render(
    <CompoundsEditor
      boardId="1"
      initialCompounds={[kaksKassi, withRemovedCard]}
      cards={cards}
      aiEnabled={false}
      onSave={onSave}
      {...props}
    />,
  )
  return { onSave }
}

const compoundButton = (name: RegExp) => screen.getByRole('button', { name })
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Salvesta' }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('compounds editor', () => {
  it('shows which cards make each compound and what it says', () => {
    renderEditor()

    expect(compoundButton(/^kaks \+ kass: kaks kassi$/)).toBeTruthy()
    expect(
      compoundButton(/^kaks \+ Kustutatud kaart: kaks palli Kaart on kustutatud$/),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Kuula: kaks kassi' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Kustuta sõnaühend kaks kassi' })).toBeTruthy()
    // Nothing changed yet.
    expect(screen.getByRole('button', { name: 'Salvestatud' }).hasAttribute('disabled')).toBe(true)
  })

  it('says the words as written unless the pronunciation differs', async () => {
    const { onSave } = renderEditor()
    fireEvent.click(compoundButton(/^kaks \+ kass/))

    // The old repeated speech forms are dropped, so the speech follows the edited word.
    fireEvent.change(screen.getAllByLabelText('Sõna')[1], { target: { value: 'kassid' } })
    save()
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][1][0].parts).toEqual([
      { surface: 'kaks', tts: '' },
      { surface: 'kassid', tts: '' },
    ])
    await screen.findByRole('button', { name: 'Salvestatud' })

    fireEvent.click(screen.getByRole('switch', { name: 'Hääldus erineb kirjapildist' }))
    fireEvent.change(screen.getAllByLabelText('Hääldus')[1], { target: { value: 'kas-sid' } })
    save()
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
    expect(onSave.mock.calls[1][1][0].parts[1]).toEqual({ surface: 'kassid', tts: 'kas-sid' })
    await screen.findByRole('button', { name: 'Salvestatud' })

    // Turning it off again makes the speech follow the word.
    fireEvent.click(screen.getByRole('switch', { name: 'Hääldus erineb kirjapildist' }))
    expect(screen.queryAllByLabelText('Hääldus')).toHaveLength(0)
    save()
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(3))
    expect(onSave.mock.calls[2][1][0].parts[1]).toEqual({ surface: 'kassid', tts: '' })
  })

  it('opens a compound that needs fixing and marks its empty word instead of saving', async () => {
    const { onSave } = renderEditor()
    const trigger = compoundButton(/^kaks \+ kass/)
    fireEvent.click(trigger)
    fireEvent.change(screen.getAllByLabelText('Sõna')[1], { target: { value: ' ' } })
    fireEvent.click(trigger)
    expect(screen.queryAllByLabelText('Sõna')).toHaveLength(0)

    save()

    const words = screen.getAllByLabelText('Sõna')
    expect(words[1].getAttribute('aria-invalid')).toBe('true')
    expect(words[0].hasAttribute('aria-invalid')).toBe(false)
    expect(screen.getAllByText(COMPOUND_MISSING_WORD).length).toBeGreaterThan(0)
    expect(toast.error).toHaveBeenCalledWith(COMPOUND_MISSING_WORD, expect.anything())
    expect(onSave).not.toHaveBeenCalled()
  })

  it('makes a new compound from the cards tapped in order', async () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Lisa sõnaühend' }))

    const dialog = screen.getByRole('dialog', { name: 'Uus sõnaühend' })
    const confirm = within(dialog).getByRole('button', { name: 'Vali vähemalt kaks kaarti' })
    expect(confirm.hasAttribute('disabled')).toBe(true)
    for (const word of ['kaks', 'suur', 'kass']) {
      fireEvent.click(within(dialog).getByRole('button', { name: word }))
    }
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lisa sõnaühend' }))

    // It opens with the cards' own words, ready to change.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(compoundButton(/^kaks \+ suur \+ kass: kaks suur kass$/)).toBeTruthy()
    expect(
      screen.getAllByLabelText('Sõna').map((input) => (input as HTMLInputElement).value),
    ).toEqual(['kaks', 'suur', 'kass'])
    expect(screen.getByRole('button', { name: 'Salvesta' })).toBeTruthy()
  })

  it('swaps a card and keeps a compound at two cards or more', () => {
    renderEditor()
    fireEvent.click(compoundButton(/^kaks \+ Kustutatud kaart/))

    expect(screen.getByRole('button', { name: 'Eemalda 1. kaart' }).hasAttribute('disabled')).toBe(
      true,
    )
    expect(screen.getByRole('button', { name: 'Eemalda 2. kaart' }).hasAttribute('disabled')).toBe(
      true,
    )

    // The removed card's place takes another card; the word the parent wrote stays.
    fireEvent.click(
      screen.getByRole('button', { name: '2. kaart: Kustutatud kaart. Vali teine kaart' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Vali kaart' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'kass' }))

    expect(compoundButton(/^kaks \+ kass: kaks palli$/)).toBeTruthy()
    expect((screen.getAllByLabelText('Sõna')[1] as HTMLInputElement).value).toBe('palli')
  })

  it('says when the board has AI on, since compounds are then off', () => {
    renderEditor({ aiEnabled: true })
    expect(screen.getByRole('note').textContent).toContain('sõnaühendeid praegu ei kasutata')
  })
})
