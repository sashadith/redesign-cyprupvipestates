// utils/debounce.ts
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  wait = 300
) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return debounced as T & { cancel: () => void };
}
