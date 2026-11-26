# @esliph/metadata documentation

The documentation follows [Diátaxis](https://diataxis.fr): each page is one of four types, and each type answers a different need.

## Tutorials

Learn the library by building something.

- [Getting started](tutorials/getting-started.md): build a route table from decorated controller classes.

## How-to guides

Solve a specific task.

- [Create custom decorators](how-to/create-custom-decorators.md)
- [Isolate metadata in separate stores](how-to/isolate-metadata.md)
- [Migrate from reflect-metadata](how-to/migrate-from-reflect-metadata.md)
- [Develop the library](how-to/develop-the-library.md): install, test, build and release, for contributors.

## Reference

Look up a fact.

- [API](reference/api.md): `ReflectMetadata`, the global `Reflect`, `MetadataContainer` and the exported types.
- [Decorators](reference/decorators.md): `metadata` and `metadataParam`.
- [Metadata locations](reference/metadata-locations.md): where each `target`, `propertyKey` and `parameterIndex` combination stores its metadata.
- [Exceptions](reference/exceptions.md)
- [Known limitations](reference/known-limitations.md)

## Explanation

Understand how and why the library works.

- [How metadata lookup works](explanation/how-lookup-works.md): locations, inheritance and the lookup cache.
- [Decorators and initializers](explanation/decorators-and-initializers.md): when decorator metadata is written.
- [Architecture](explanation/architecture/overview.md), for contributors:
  - [Overview](explanation/architecture/overview.md): layers, modules and the build pipeline.
  - [Storage model](explanation/architecture/storage-model.md): data structures, normalization and costs.
  - [Design decisions](explanation/architecture/design-decisions.md): the choices that shape the library, with their trade-offs.
