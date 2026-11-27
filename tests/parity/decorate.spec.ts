import { describe, test } from 'vitest'

import { capture, expectParity } from '@tests/parity/harness'

function labelOf(value: unknown, known: [string, unknown][]) {
  return known.find(([, candidate]) => candidate === value)?.[0] ?? 'other'
}

describe('Parity with reflect-metadata: decorate', () => {
  test('class form applies decorators from last to first', () => {
    expectParity(api => {
      class Original {}

      const log: string[] = []
      const decorators = ['first', 'second', 'third'].map(name => () => {
        log.push(name)
      })

      const result = api.decorate(decorators, Original)

      return [log, labelOf(result, [['original', Original]])]
    })
  })

  test('class form replaces the target with a non-null return', () => {
    expectParity(api => {
      class Original {}
      class Replacement {}

      const received: string[] = []
      const outer = (target: unknown) => {
        received.push(labelOf(target, [['original', Original], ['replacement', Replacement]]))
      }
      const middle = () => Replacement

      const result = api.decorate([outer, middle], Original)

      return [received, labelOf(result, [['original', Original], ['replacement', Replacement]])]
    })
  })

  test('class form rejects a non-constructor return', () => {
    expectParity(api => api.decorate([() => ({})], class Original {}))
  })

  test('class form rejects a non-constructor target', () => {
    expectParity(api => api.decorate([() => undefined], {}))
  })

  test('member form passes target, key and descriptor', () => {
    expectParity(api => {
      class Subject {}

      const descriptor = { value: 1 }
      const log: unknown[] = []
      const decorator = (target: unknown, key: unknown, received: unknown) => {
        log.push([labelOf(target, [['prototype', Subject.prototype]]), key, received === descriptor ? 'descriptor' : 'other'])
      }

      const result = api.decorate([decorator], Subject.prototype, 'm', descriptor)

      return [log, result === descriptor ? 'descriptor' : 'other']
    })
  })

  test('member form replaces the descriptor with a non-null return', () => {
    expectParity(api => {
      class Subject {}

      const descriptor = { value: 1 }
      const replacement = { value: 2 }

      const result = api.decorate([() => replacement], Subject.prototype, 'm', descriptor)

      return labelOf(result, [['descriptor', descriptor], ['new descriptor', replacement]])
    })
  })

  test('member form rejects a non-object return', () => {
    expectParity(api => api.decorate([() => 1], class Subject {}.prototype, 'm', { value: 1 }))
  })

  test('member form treats null attributes as undefined', () => {
    expectParity(api => {
      const log: unknown[] = []
      const decorator = (_target: unknown, _key: unknown, received: unknown) => {
        log.push(received)
      }

      const result = api.decorate([decorator], class Subject {}.prototype, 'm', null)

      return [log, result]
    })
  })

  test('member form rejects invalid attributes', () => {
    expectParity(api => api.decorate([() => undefined], class Subject {}.prototype, 'm', 1))
  })

  test('member form converts the property key', () => {
    expectParity(api => {
      const log: unknown[] = []
      const decorator = (_target: unknown, key: unknown) => {
        log.push(key)
      }

      api.decorate([decorator], class Subject {}.prototype, 1)

      return log
    })
  })

  test('decorators must be an array', () => {
    expectParity(api => [
      capture(() => api.decorate({}, class Subject {})),
      capture(() => api.decorate({}, class Subject {}.prototype, 'm')),
    ])
  })

  test('member form rejects an invalid target', () => {
    expectParity(api => api.decorate([() => undefined], 1, 'm'))
  })
})
