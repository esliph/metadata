import { expect, test } from 'vitest'

import { expectParity, oracle } from '@tests/parity/harness'

test('expectParity fails when the two implementations differ', () => {
  expect(() => expectParity(api => api === oracle)).toThrow()
})
