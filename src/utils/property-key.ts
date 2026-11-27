export function toPropertyKey(key: unknown): string | symbol {
  // A computed property name runs the engine's own ToPropertyKey (ToPrimitive with hint string), which is what reflect-metadata ports by hand
  const holder = { [key as PropertyKey]: true }

  return Object.getOwnPropertySymbols(holder)[0] ?? Object.keys(holder)[0]
}
