// "Calm Study" style: warm off-white paper, indigo accent. See docs/SPEC.md.
export const calmStudy = {
  light: {
    background: '#FAF7F0',
    text: '#1F2433',
    mutedText: '#5B6070',
    accent: '#3B4A9C',
    onAccent: '#FFFFFF',
  },
  // Provisional dark palette; confirm with the user before release.
  dark: {
    background: '#14161F',
    text: '#ECEAF4',
    mutedText: '#A3A7B8',
    accent: '#8E9BEA',
    onAccent: '#14161F',
  },
} as const;
