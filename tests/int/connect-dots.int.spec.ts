import { describe, expect, it } from 'vitest'
import {
  getConnectDotsLabel,
  moveItem,
  serializeConnectDotsPuzzle,
  validateConnectDotsDots,
} from '@/utilities/connectDots'

describe('connect dots utilities', () => {
  it('validates dot arrays inside image bounds', () => {
    expect(validateConnectDotsDots([{ x: 0.1, y: 0.2 }, { x: 0.8, y: 0.9 }])).toBe(true)
    expect(validateConnectDotsDots([{ x: 0.1, y: 0.2 }])).toBe('Lisa pildile vähemalt 2 punkti.')
    expect(validateConnectDotsDots([{ x: -0.1, y: 0.2 }, { x: 0.5, y: 0.5 }])).toBe(
      'Punkt 1 peab jääma pildi sisse.',
    )
  })

  it('builds numeric and alphabet labels', () => {
    expect(getConnectDotsLabel('count-1', 0)).toBe('1')
    expect(getConnectDotsLabel('count-4', 3)).toBe('16')
    expect(getConnectDotsLabel('alphabet', 0)).toBe('A')
    expect(getConnectDotsLabel('alphabet', 27)).toBe('AB')
  })

  it('moves dots in order safely', () => {
    expect(moveItem([1, 2, 3], 2, 0)).toEqual([3, 1, 2])
    expect(moveItem([1, 2, 3], 1, 1)).toEqual([1, 2, 3])
  })

  it('serializes playable puzzles only when image and dots are present', () => {
    expect(
      serializeConnectDotsPuzzle({
        id: 'cat',
        title: 'Cat',
        description: 'A cat outline',
        dots: [
          { x: 0.1, y: 0.2 },
          { x: 0.7, y: 0.8 },
        ],
        image: {
          url: '/media/cat.png',
          alt: 'Cat',
          width: 1000,
          height: 800,
        },
      }),
    ).toMatchObject({
      id: 'cat',
      title: 'Cat',
      imageUrl: '/media/cat.png',
      dots: [
        { x: 0.1, y: 0.2 },
        { x: 0.7, y: 0.8 },
      ],
    })

    expect(
      serializeConnectDotsPuzzle({
        id: 'broken',
        title: 'Broken',
        dots: [{ x: 0.1, y: 0.2 }],
        image: { url: '/media/broken.png' },
      }),
    ).toBeNull()
  })
})
