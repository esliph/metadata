import { MetadataKey, MetadataValue } from '@contracts/metadata'

export type StoredPropertyKey = string | symbol

export class MetadataSlot {

  readonly values = new Map<MetadataKey, MetadataValue>()

  readonly stamps = new Map<MetadataKey, number>()

  get isEmpty() {
    return this.values.size === 0 && this.stamps.size === 0
  }
}

export class TargetMetadata {

  protected readonly members = new Map<StoredPropertyKey | undefined, MetadataSlot>()

  protected readonly parameters = new Map<StoredPropertyKey | undefined, Map<number, MetadataSlot>>()

  get isEmpty() {
    return this.members.size === 0 && this.parameters.size === 0
  }

  getSlot(propertyKey: StoredPropertyKey | undefined, parameterIndex: number | undefined) {
    if (parameterIndex === undefined) {
      return this.members.get(propertyKey)
    }

    return this.parameters.get(propertyKey)?.get(parameterIndex)
  }

  getOrCreateSlot(propertyKey: StoredPropertyKey | undefined, parameterIndex: number | undefined) {
    const existing = this.getSlot(propertyKey, parameterIndex)

    if (existing) {
      return existing
    }

    const slot = new MetadataSlot()

    if (parameterIndex === undefined) {
      this.members.set(propertyKey, slot)

      return slot
    }

    let slots = this.parameters.get(propertyKey)

    if (!slots) {
      slots = new Map()

      this.parameters.set(propertyKey, slots)
    }

    slots.set(parameterIndex, slot)

    return slot
  }

  removeSlotIfEmpty(propertyKey: StoredPropertyKey | undefined, parameterIndex: number | undefined) {
    const slot = this.getSlot(propertyKey, parameterIndex)

    if (!slot || !slot.isEmpty) {
      return
    }

    if (parameterIndex === undefined) {
      this.members.delete(propertyKey)

      return
    }

    const slots = this.parameters.get(propertyKey)!

    slots.delete(parameterIndex)

    if (slots.size === 0) {
      this.parameters.delete(propertyKey)
    }
  }
}
