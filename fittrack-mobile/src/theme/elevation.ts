// Soft elevation used across cards for a bit of depth beyond a flat 1px
// border — mostly visible in light mode; dark mode leans on the border.
export const cardElevation = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.05,
  shadowRadius: 10,
  elevation: 2,
} as const;

// Section/card corner radius scale, kept consistent app-wide.
export const radius = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 18,
} as const;

// The small uppercase "eyebrow" label used above a group of cards
// (e.g. "QUICK ACTIONS", "ACTIVITY HISTORY").
export const sectionLabel = {
  fontSize: 11,
  fontWeight: '700' as const,
  letterSpacing: 1,
  textTransform: 'uppercase' as const,
};
