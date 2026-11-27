const symbolConstructor = Symbol as { metadata?: symbol }

// Symbol.for is esbuild's fallback key (__knownSymbol), so classes compiled by esbuild and by tsc share it
symbolConstructor.metadata ??= Symbol.for('Symbol.metadata')

export const SYMBOL_METADATA = symbolConstructor.metadata
