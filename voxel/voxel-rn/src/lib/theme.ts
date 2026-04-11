export const COLORS = {
  // Backgrounds
  bg:       '#080d1a',
  card:     '#111827',
  surface:  '#1a2235',
  border:   '#1e2d45',

  // Brand
  teal:     '#0b9488',
  teal2:    '#14b8a6',
  tealLight:'#5eead4',

  // Text
  text:     '#f1f5f9',
  subtle:   '#94a3b8',
  muted:    '#475569',

  // Semantic
  red:      '#ef4444',
  redLight: '#f87171',
  amber:    '#f59e0b',
  blue:     '#3b82f6',
  purple:   '#a855f7',

  white:    '#ffffff',
  black:    '#000000',
}

export const GRADIENTS = {
  teal:   ['#0b9488', '#14b8a6'] as const,
  blue:   ['#2563eb', '#3b82f6'] as const,
  purple: ['#7c3aed', '#a78bfa'] as const,
  dark:   ['#0b9488', '#0a6560'] as const,
}

export const RADIUS = {
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  full: 9999,
}

export const FONT = {
  // Use system fonts — closest to Sora/DM Sans on mobile
  bold:     'System',
  semibold: 'System',
  regular:  'System',
}
