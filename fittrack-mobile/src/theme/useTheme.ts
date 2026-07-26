import { Colors, ThemeColors } from './colors';

// Dark ("Warm Iron") is the only shipped theme for now — the redesign's own
// notes call for dark as the default and light as a real, separate setting
// later, not a filter over this one. Ignore the system scheme until that
// setting exists.
export function useTheme(): { colors: ThemeColors; isDark: boolean } {
  return { colors: Colors.dark, isDark: true };
}
