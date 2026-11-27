import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { replaceTscAliasPaths } from 'tsc-alias'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

const config = path.resolve(__dirname, 'tsconfig.json')
const preload = path.resolve(__dirname, 'record-symbol-metadata.cjs')

describe('tsc emit', () => {
  let out: string

  beforeAll(async () => {
    out = mkdtempSync(path.join(tmpdir(), 'esliph-metadata-emit-'))

    execFileSync(process.execPath, [path.resolve(__dirname, '../../node_modules/typescript/bin/tsc'), '-p', config, '--outDir', out])

    await replaceTscAliasPaths({ configFile: config, outDir: out })
  }, 60_000)

  afterAll(() => {
    rmSync(out, { recursive: true, force: true })
  })

  test.each(['index-entry', 'decorator-module'])('%s fixture compiled by tsc records member metadata', name => {
    const fixture = path.join(out, 'tests/emit', `${name}.fixture.js`)

    const output = execFileSync(process.execPath, ['-r', preload, fixture], { encoding: 'utf8' })

    expect(JSON.parse(output)).toEqual({
      predefined: false,
      instanceMethod: 'v',
      staticField: 'v',
      methodParameter: 'v',
      constructorParameter: 'v',
      inherited: 'v',
      staticInitializer: 'v',
    })
  })
})
