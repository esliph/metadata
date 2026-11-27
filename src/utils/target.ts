import { MetadataTarget } from '@contracts/metadata'

export function isValidTarget(target: unknown): target is MetadataTarget {
  return typeof target === 'object' ? target !== null : typeof target === 'function'
}
