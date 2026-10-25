import tailwindcssAnimate from 'tailwindcss-animate'
import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  plugins: [tailwindcssAnimate, typography],
  prefix: '',
  safelist: [
    'lg:col-span-4',
    'lg:col-span-6',
    'lg:col-span-8',
    'lg:col-span-12',
    'border-border',
    'bg-card',
    'border-error',
    'bg-error/30',
    'border-success',
    'bg-success/30',
    'border-warning',
    'bg-warning/30',
  ],
  theme: {
    container: {
      center: true,
      padding: {
        '2xl': '2rem',
        DEFAULT: '1rem',
        lg: '2rem',
        md: '2rem',
        sm: '1rem',
        xl: '2rem',
      },
      screens: {
        '2xl': '86rem',
        lg: '64rem',
        md: '48rem',
        sm: '40rem',
        xl: '80rem',
      },
    },
    extend: {
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        // Brand motion: springy, like pressing or placing a physical tile. Use with `motion-safe:`.
        'tile-drop': 'tile-drop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'pop-in': 'pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'chip-in': 'chip-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'tile-hint': 'tile-hint 1.6s ease-out 0.4s 3',
        'sound-bar': 'sound-bar 0.6s ease-in-out infinite alternate',
        'draw-x': 'draw-x 0.5s ease-out both',
        'fade-up': 'fade-up 0.3s ease-out both',
      },
      screens: {
        xs: '440px',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        background: 'hsl(var(--background))',
        border: 'hsla(var(--border))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        foreground: 'hsl(var(--foreground))',
        input: 'hsl(var(--input))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        ring: 'hsl(var(--ring))',
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        success: 'hsl(var(--success))',
        error: 'hsl(var(--error))',
        warning: 'hsl(var(--warning))',
      },
      fontFamily: {
        display: ['var(--font-display)', 'var(--font-geist-sans)', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        sans: ['var(--font-geist-sans)'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        // These use the individual `translate`/`scale` properties, so they don't override a
        // Tailwind `rotate-*` transform on the same element.
        'tile-drop': {
          from: { opacity: '0', translate: '0 -32px', scale: '0.85' },
          '60%': { opacity: '1', translate: '0 4px', scale: '1.03' },
          to: { opacity: '1', translate: '0 0', scale: '1' },
        },
        'pop-in': {
          from: { opacity: '0', translate: '0 10px', scale: '0.6' },
          '70%': { opacity: '1', scale: '1.06' },
          to: { opacity: '1', translate: '0 0', scale: '1' },
        },
        'chip-in': {
          from: { opacity: '0', translate: '0 6px', scale: '0.5' },
          '70%': { opacity: '1', scale: '1.1' },
          to: { opacity: '1', translate: '0 0', scale: '1' },
        },
        'tile-hint': {
          '0%': { scale: '1', boxShadow: '0 0 0 0 rgba(255, 152, 13, 0.5)' },
          '15%': { scale: '1.04' },
          '30%': { scale: '1' },
          '100%': { scale: '1', boxShadow: '0 0 0 18px rgba(255, 152, 13, 0)' },
        },
        'sound-bar': {
          from: { scale: '1 0.35' },
          to: { scale: '1 1' },
        },
        'draw-x': {
          from: { scale: '0 1' },
          to: { scale: '1 1' },
        },
        'fade-up': {
          from: { opacity: '0', translate: '0 8px' },
          to: { opacity: '1', translate: '0 0' },
        },
      },
      typography: () => ({
        DEFAULT: {
          css: [
            {
              // Brand navy text and the rounded display face for headings, matching the homepage.
              '--tw-prose-body': '#344259',
              '--tw-prose-headings': '#22314c',
              '--tw-prose-bold': '#22314c',
              '--tw-prose-links': '#1359b7',
              '--tw-prose-bullets': '#8a94a8',
              '--tw-prose-counters': '#56627a',
              'h1, h2, h3, h4': {
                fontFamily: 'var(--font-display), var(--font-geist-sans), sans-serif',
                letterSpacing: '-0.01em',
              },
              h1: {
                fontWeight: 900,
                marginBottom: '0.25em',
              },
              h2: {
                fontWeight: 900,
              },
              h3: {
                fontWeight: 800,
              },
              a: {
                fontWeight: 600,
                textUnderlineOffset: '4px',
              },
            },
          ],
        },
        base: {
          css: [
            {
              h1: {
                fontSize: '2.5rem',
              },
              h2: {
                fontSize: '1.75rem',
                lineHeight: 1.15,
              },
              h3: {
                fontSize: '1.25rem',
              },
            },
          ],
        },
        md: {
          css: [
            {
              h1: {
                fontSize: '3.5rem',
              },
              h2: {
                fontSize: '2.25rem',
              },
              h3: {
                fontSize: '1.35rem',
              },
            },
          ],
        },
      }),
    },
  },
}

export default config
