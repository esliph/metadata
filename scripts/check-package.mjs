import { execFileSync, execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const POLYFILL = 'dist/polyfills/symbol-metadata.js'

function fail(message) {
  console.error(`check:package failed: ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) {
    fail(message)
  }
}

function checkBuildOutput() {
  assert(existsSync(path.join(root, 'dist/index.d.ts')), 'dist/index.d.ts does not exist. Run "npm run build" first.')
}

function checkManifest() {
  const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
  const rootExport = manifest.exports?.['.']

  assert(rootExport && Object.keys(rootExport)[0] === 'types', 'exports["."] must list "types" as its first key.')
  assert(rootExport.types === './dist/index.d.ts', `exports["."].types must be "./dist/index.d.ts", but is "${rootExport.types}".`)

  const { sideEffects } = manifest

  assert(
    sideEffects === undefined || (Array.isArray(sideEffects) && sideEffects.includes(`./${POLYFILL}`)),
    `sideEffects must be absent or an array containing "./${POLYFILL}".`
  )
}

function listPackedFiles() {
  const packed = JSON.parse(execSync('npm pack --dry-run --json', { cwd: root, encoding: 'utf8' }))
  const paths = packed[0].files.map(file => file.path)

  for (const required of ['dist/index.d.ts', 'dist/index.js', POLYFILL]) {
    assert(paths.includes(required), `the package must contain "${required}".`)
  }

  const leaked = paths.filter(file => file.startsWith('src/') || file.startsWith('tests/'))

  assert(leaked.length === 0, `the package must not contain src/ or tests/ files, but contains: ${leaked.join(', ')}.`)

  return paths
}

function checkConsumer(paths) {
  const consumer = mkdtempSync(path.join(tmpdir(), 'esliph-metadata-consumer-'))

  try {
    const installed = path.join(consumer, 'node_modules/@esliph/metadata')

    for (const file of paths) {
      mkdirSync(path.dirname(path.join(installed, file)), { recursive: true })
      copyFileSync(path.join(root, file), path.join(installed, file))
    }

    writeFileSync(
      path.join(consumer, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { module: 'node16', moduleResolution: 'node16', strict: true, noEmit: true, types: [] }, include: ['index.ts'] })
    )

    writeFileSync(
      path.join(consumer, 'index.ts'),
      [
        'import { Reflect, ReflectMetadata, ReflectMetadataErrorCode, ReflectMetadataException } from \'@esliph/metadata\'',
        '',
        'const store: ReflectMetadata = new ReflectMetadata()',
        'const value: unknown = Reflect.getMetadata(\'key\', class Subject {})',
        'const error: TypeError = new ReflectMetadataException(ReflectMetadataErrorCode.TARGET_METADATA_INVALID, \'message\')',
        '',
        'void [store, value, error]',
        '',
      ].join('\n')
    )

    try {
      execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', consumer], { encoding: 'utf8' })
    } catch (error) {
      fail(`a TypeScript consumer does not compile against the package types:\n${error.stdout}`)
    }

    const output = execFileSync(process.execPath, ['-e', 'require(\'@esliph/metadata\'); console.log(typeof Symbol.metadata)'], { cwd: consumer, encoding: 'utf8' })

    assert(output.trim() === 'symbol', `requiring the package must define Symbol.metadata, but typeof Symbol.metadata is "${output.trim()}".`)
  } finally {
    rmSync(consumer, { recursive: true, force: true })
  }
}

checkBuildOutput()
checkManifest()
checkConsumer(listPackedFiles())

console.log('check:package passed')
