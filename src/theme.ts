/** Design tokens. Every style in the app reads its values from here. */
export const theme = {
  colors: {
    background: '#0D0D0D', // Very dark gray, almost black
    surface: '#1A1A1A', // Slightly lighter for cards
    surfaceHighlight: '#2A2A2A',
    primary: '#FF4500', // Vibrant Orange-Red for actions
    primaryHover: '#FF5722',
    text: '#FFFFFF',
    textSecondary: '#A0A0A0',
    border: '#333333',
    error: '#CF6679',
    success: '#03DAC6',
    onPrimary: '#FFFFFF',
    danger: '#FF4444',
    // 3D anatomy palette: muted neutral structure with escalating heat toward `primary`.
    anatomy: {
      canvas: '#121316',
      bone: '#2E313A',
      other: '#3B3F4A',
      none: '#545966',
      light: '#7A3820',
      moderate: '#C43E12',
      high: '#FF4500',
      selected: '#FF7D45',
    },
    nutrition: {
      track: '#242424',
      protein: '#3FA9F5',
      carbs: '#F7B32B',
      fat: '#B57BFF',
      deficit: '#3FA9F5',
      maintenance: '#03DAC6',
      surplus: '#FF8A3D',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  typography: {
    sizes: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 20,
      xl: 24,
      xxl: 32,
    },
    // `as const` keeps these as string literals so they satisfy
    // React Native's `TextStyle['fontWeight']` without a cast.
    weights: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    } as const,
  },
};
