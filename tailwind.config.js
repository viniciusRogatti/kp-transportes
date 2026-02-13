/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-2': 'var(--color-surface-2)',
        card: 'var(--color-card)',
        text: 'var(--color-text)',
        muted: 'var(--color-muted)',
        accent: 'var(--color-accent)',
        'accent-strong': 'var(--color-accent-strong)',
        border: 'var(--color-border)',
        'text-accent': 'var(--color-text-accent)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        info: 'var(--color-info)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        display: ['"Space Grotesk"', '"Plus Jakarta Sans"', 'sans-serif'],
      },
      borderRadius: {
        sm: 'var(--radius-1)',
        md: 'var(--radius-2)',
        lg: 'var(--radius-3)',
        xl: 'var(--radius-4)',
      },
      boxShadow: {
        soft: 'var(--shadow-1)',
        elevated: 'var(--shadow-2)',
        strong: 'var(--shadow-3)',
      },
      spacing: {
        s1: 'var(--space-1)',
        s2: 'var(--space-2)',
        s3: 'var(--space-3)',
        s4: 'var(--space-4)',
        s5: 'var(--space-5)',
        s6: 'var(--space-6)',
        s7: 'var(--space-7)',
        s8: 'var(--space-8)',
      },
    },
  },
  plugins: [],
};
