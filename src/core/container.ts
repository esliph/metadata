import { MetadataKey, MetadataTarget, MetadataValue, PropertyKey } from '@contracts/metadata'
import { DecoratorRecord } from '@core/decorator-record'
import { MetadataSlot, StoredPropertyKey, TargetMetadata } from '@core/target-metadata'
import { assertValidTarget } from '@core/target'
import { SYMBOL_METADATA } from '@polyfills/symbol-metadata'
import { toPropertyKey } from '@utils/property-key'
import { ordinaryGetPrototypeOf } from '@utils/prototype'

export class MetadataContainer {

  protected storage = new WeakMap<object, TargetMetadata>()

  protected readonly recordsKey = Symbol('@esliph/metadata:records')

  protected nextStamp = 0

  protected pendingRecords = 0

  defineMetadata(key: MetadataKey, value: MetadataValue, target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number): void {
    const member = this.resolveMember(target, propertyKey)

    this.drain(target)

    const slot = this.getOrCreateTargetMetadata(target).getOrCreateSlot(member, parameterIndex)

    slot.values.set(key, value)

    this.markExplicitWrite(slot, key)
  }

  deleteMetadata(key: MetadataKey, target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number): boolean {
    const member = this.resolveMember(target, propertyKey)

    this.drain(target)

    const stamping = this.pendingRecords > 0
    const targetMetadata = stamping ? this.getOrCreateTargetMetadata(target) : this.storage.get(target)
    const slot = stamping ? targetMetadata!.getOrCreateSlot(member, parameterIndex) : targetMetadata?.getSlot(member, parameterIndex)

    if (!targetMetadata || !slot) {
      return false
    }

    const removed = slot.values.delete(key)

    this.markExplicitWrite(slot, key)

    targetMetadata.removeSlotIfEmpty(member, parameterIndex)

    if (targetMetadata.isEmpty) {
      this.storage.delete(target)
    }

    return removed
  }

  hasMetadata(key: MetadataKey, target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number): boolean {
    const member = this.resolveMember(target, propertyKey)

    for (let current: object | null = target as object; current !== null; current = ordinaryGetPrototypeOf(current)) {
      this.drain(current)

      if (this.storage.get(current)?.getSlot(member, parameterIndex)?.values.has(key)) {
        return true
      }
    }

    return false
  }

  hasOwnMetadata(key: MetadataKey, target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number): boolean {
    const member = this.resolveMember(target, propertyKey)

    this.drain(target)

    return this.storage.get(target)?.getSlot(member, parameterIndex)?.values.has(key) ?? false
  }

  // There is no lookup cache: a write on any ancestor and Object.setPrototypeOf would need invalidation across every descendant
  getMetadata(key: MetadataKey, target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number): any {
    const member = this.resolveMember(target, propertyKey)

    for (let current: object | null = target as object; current !== null; current = ordinaryGetPrototypeOf(current)) {
      this.drain(current)

      const values = this.storage.get(current)?.getSlot(member, parameterIndex)?.values

      if (values?.has(key)) {
        return values.get(key)
      }
    }

    return undefined
  }

  getOwnMetadata(key: MetadataKey, target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number): any {
    const member = this.resolveMember(target, propertyKey)

    this.drain(target)

    return this.storage.get(target)?.getSlot(member, parameterIndex)?.values.get(key)
  }

  getMetadataKeys(target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number): any[] {
    const member = this.resolveMember(target, propertyKey)
    const seen = new Set<MetadataKey>()
    const keys: MetadataKey[] = []

    for (let current: object | null = target as object; current !== null; current = ordinaryGetPrototypeOf(current)) {
      this.drain(current)

      const values = this.storage.get(current)?.getSlot(member, parameterIndex)?.values

      if (!values) {
        continue
      }

      for (const key of values.keys()) {
        if (!seen.has(key)) {
          seen.add(key)
          keys.push(key)
        }
      }
    }

    return keys
  }

  getOwnMetadataKeys(target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number): any[] {
    const member = this.resolveMember(target, propertyKey)

    this.drain(target)

    const values = this.storage.get(target)?.getSlot(member, parameterIndex)?.values

    return values ? Array.from(values.keys()) : []
  }

  enqueueDecoratorRecord(metadataObject: object, record: Omit<DecoratorRecord, 'stamp'>): void {
    // context.metadata inherits from the parent class's object, so the array must be an own property
    let records: DecoratorRecord[] | undefined = Object.prototype.hasOwnProperty.call(metadataObject, this.recordsKey)
      ? (metadataObject as any)[this.recordsKey]
      : undefined

    if (!records) {
      records = []

      Object.defineProperty(metadataObject, this.recordsKey, { value: records, configurable: true, writable: true, enumerable: false })
    }

    records.push({ ...record, stamp: ++this.nextStamp })

    this.pendingRecords += 1
  }

  protected resolveMember(target: MetadataTarget, propertyKey: PropertyKey | undefined): StoredPropertyKey | undefined {
    assertValidTarget(target)

    return propertyKey === undefined ? undefined : toPropertyKey(propertyKey)
  }

  protected getOrCreateTargetMetadata(target: object) {
    let targetMetadata = this.storage.get(target)

    if (!targetMetadata) {
      targetMetadata = new TargetMetadata()

      this.storage.set(target, targetMetadata)
    }

    return targetMetadata
  }

  // A record can only replay over a write made after it while its class is still undrained, and the only window for that is a class
  // decorator body, before Symbol.metadata is attached. With no pending record, no later record can target an existing slot, so the stamp is dropped.
  protected markExplicitWrite(slot: MetadataSlot, key: MetadataKey) {
    if (this.pendingRecords > 0) {
      slot.stamps.set(key, ++this.nextStamp)

      return
    }

    slot.stamps.delete(key)
  }

  // Never calls object.hasOwnProperty: the object may have no Object.prototype
  protected ownerOf(object: object): Function | undefined {
    if (typeof object === 'function') {
      return this.constructorOfPrototype((object as Function).prototype) ?? object
    }

    return this.constructorOfPrototype(object)
  }

  // A class and its prototype must resolve to the same owner, or a Proxy returned by a class decorator makes static records depend on the order of reads
  protected constructorOfPrototype(prototype: unknown): Function | undefined {
    if (typeof prototype !== 'object' || prototype === null) {
      return undefined
    }

    const constructor = Object.getOwnPropertyDescriptor(prototype, 'constructor')?.value

    return typeof constructor === 'function' && constructor.prototype === prototype ? constructor : undefined
  }

  protected drain(object: object) {
    if (this.pendingRecords === 0) {
      return
    }

    const owner = this.ownerOf(object)

    if (!owner) {
      return
    }

    const metadataObject = Object.getOwnPropertyDescriptor(owner, SYMBOL_METADATA)?.value

    if (typeof metadataObject !== 'object' || metadataObject === null || !Object.prototype.hasOwnProperty.call(metadataObject, this.recordsKey)) {
      return
    }

    const records: DecoratorRecord[] = metadataObject[this.recordsKey]

    delete metadataObject[this.recordsKey]

    this.pendingRecords -= records.length

    for (const record of records) {
      this.replay(owner, record)
    }
  }

  protected replay(owner: Function, record: DecoratorRecord) {
    const target = record.placement === 'static' ? owner : owner.prototype
    const slot = this.getOrCreateTargetMetadata(target).getOrCreateSlot(record.propertyKey, record.parameterIndex)
    const stamp = slot.stamps.get(record.key)

    if (stamp !== undefined && stamp > record.stamp) {
      return
    }

    slot.values.set(record.key, record.value)
  }
}
