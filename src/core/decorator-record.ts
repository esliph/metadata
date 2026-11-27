import { MetadataKey, MetadataValue } from '@contracts/metadata'

export interface DecoratorRecord {
  placement: 'static' | 'instance'
  propertyKey: string | symbol
  key: MetadataKey
  value: MetadataValue
  parameterIndex: number | undefined
  stamp: number
}
