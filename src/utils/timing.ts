export async function timeNamed<T>(
  name: string,
  fn: () => Promise<T>,
  acc: Record<string, number>,
): Promise<T> {
  const started = Date.now();
  try {
    return await fn();
  } finally {
    acc[name] = Date.now() - started;
  }
}

export function formatTimingLegs(acc: Record<string, number>): string {
  return Object.entries(acc)
    .map(([name, ms]) => `${name}=${ms}ms`)
    .join(' ');
}
