# Contributing

## Code of conduct

Everyone who takes part in this project follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Report a bug or request a feature

Open an issue at <https://github.com/Esliph/metadata/issues/new/choose> and pick a form.

Read [Known limitations](docs/reference/known-limitations.md) first: the behavior may already be documented.

Report a security vulnerability as described in [SECURITY.md](SECURITY.md). Do not open an issue for it.

## Set up

1. Install Node.js 22 or later.
2. Fork the repository and clone your fork.
3. Install the dependencies:

```bash
npm ci
```

## Run the checks

Run each command on its own line, in this order:

```bash
npm run lint
npx tsc -p tests/tsconfig.json --noEmit
npx vitest run
npm run build
npm run check:package
```

CI runs the same checks on Node 22 and 24.

[Develop the library](docs/how-to/develop-the-library.md) shows how to run a single test, read the coverage report and understand the build.

## Keep parity with `reflect-metadata`

The library behaves like `reflect-metadata` 0.2.2 on every shared operation. The tests in `tests/parity` run each scenario on both libraries and compare the results.

The `reflect-metadata` store is process-global. In a parity test, create the metadata keys once per test, outside the scenario, and create the targets inside it.

## Update the documentation

A change of behavior updates the matching pages in `docs/reference`, and the README when the behavior appears there.

A new limitation goes to [Known limitations](docs/reference/known-limitations.md).

## Write commit messages

Use the format `type: Description`, in English, with the verb in the gerund.

Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `config`.

Examples:

- `feat: Matching reflect-metadata 0.2.2 semantics`
- `test: Adding parity cases for the metadata decorator`

## Open a pull request

1. Branch from `master`.
2. Keep one topic in each pull request.
3. Link the issue the pull request closes.
4. Fill in the pull request template.

## License

Your contributions are published under the [MIT license](LICENSE).
