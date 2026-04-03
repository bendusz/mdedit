const STORAGE_KEY = 'mdedit-content-width';
const DEFAULT_WIDTH = '80ch';

export const widthPresets = [
  { label: 'Narrow', value: '60ch' },
  { label: 'Normal', value: '80ch' },
  { label: 'Wide', value: '100ch' },
  { label: 'Extra Wide', value: '120ch' },
  { label: 'Full', value: '100%' },
] as const;

function loadWidth(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && widthPresets.some((p) => p.value === stored)) {
      return stored;
    }
  } catch {
    // localStorage may be unavailable
  }
  return DEFAULT_WIDTH;
}

let width = $state(loadWidth());

export const contentWidthState = {
  get width() { return width; },
  setWidth(newWidth: string) {
    width = newWidth;
    try {
      localStorage.setItem(STORAGE_KEY, newWidth);
    } catch {
      // localStorage may be unavailable
    }
  },
};
