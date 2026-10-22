export function formatMemoryLimit(value: string): string {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)([mg])$/i);
  if (!match) return value;
  return `${match[1]}${match[2].toLowerCase() === 'g' ? 'GB' : 'MB'}`;
}
