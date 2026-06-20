export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return input;
  return input
    .trim()
    .split('')
    .filter(c => c.charCodeAt(0) > 31 && c.charCodeAt(0) !== 127)
    .join('');
}
