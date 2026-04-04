/** Toast notification store using Svelte 5 runes. */

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

let toasts = $state<Toast[]>([]);
let nextId = 0;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function generateId(): string {
  return `toast-${++nextId}-${Date.now()}`;
}

export function showToast(
  message: string,
  type: ToastType = 'info',
  duration: number = 4000,
): string {
  const id = generateId();
  const toast: Toast = { id, message, type, duration };
  toasts = [...toasts, toast];

  const timer = setTimeout(() => {
    dismissToast(id);
  }, duration);
  timers.set(id, timer);

  return id;
}

export function dismissToast(id: string): void {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  toasts = toasts.filter((t) => t.id !== id);
}

export const toastState = {
  get toasts() {
    return toasts;
  },
};
