# Getting started: build a route table with decorators

In this tutorial you will build a small project that marks controller classes with decorators and turns them into a route table. By the end, running the project prints every route, its handler method and its parameter names, all read back from metadata.

You need Node.js and npm. No previous knowledge of decorators or metadata is needed.

## 1. Create the project

Create a folder, install the library and TypeScript, and add a `tsconfig.json`:

```bash
mkdir routes-demo
cd routes-demo
npm init -y
npm install @esliph/metadata typescript
```

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

The library uses standard decorators, the decorator syntax that JavaScript is standardizing. TypeScript enables them by default from version 5.0. Do not enable `experimentalDecorators`, which switches TypeScript to its older, incompatible decorators.

Check the compiler version:

```bash
npx tsc --version
```

The version is 5.0 or later. This tutorial was tested with TypeScript 5.9 and 7.0.

## 2. Write the decorators

Create `src/decorators.ts`. Each function returns a decorator that stores one value under one key:

```ts
import { Reflect } from '@esliph/metadata'

export function Controller(prefix: string) {
  return Reflect.metadata('http:prefix', prefix)
}

export function Get(path: string) {
  return Reflect.metadata('http:get', path)
}

export function Param(index: number, name: string) {
  return Reflect.metadataParam(index, 'http:param', name)
}
```

`Reflect` here is the library's global store, not the native `Reflect` object.

## 3. Decorate a controller

Create `src/users.controller.ts`:

```ts
import { Controller, Get, Param } from './decorators'

@Controller('/users')
export class UsersController {
  @Get('/')
  list() {
    return ['ada', 'linus']
  }

  @Get('/:id')
  @Param(0, 'id')
  find(id: string) {
    return `user ${id}`
  }
}
```

`@Param(0, 'id')` sits on the method and names its first parameter.

## 4. Read the metadata

Create `src/main.ts`:

```ts
import { Reflect } from '@esliph/metadata'

import { UsersController } from './users.controller'

console.log(Reflect.getMetadata('http:prefix', UsersController))
console.log(Reflect.getMetadata('http:get', UsersController.prototype, 'find'))
```

Compile and run:

```bash
npx tsc
node dist/main.js
```

The output is:

```
/users
undefined
```

The class prefix is there, but the route of `find` is not. A decorator on a class writes its metadata when the class is defined. A decorator on an instance method writes its metadata when the first instance is created, and the program has not created one yet.

## 5. Create an instance first

Replace `src/main.ts`:

```ts
import { Reflect } from '@esliph/metadata'

import { UsersController } from './users.controller'

const controller = new UsersController()

console.log(Reflect.getMetadata('http:prefix', UsersController))
console.log(Reflect.getMetadata('http:get', UsersController.prototype, 'find'))
console.log(Reflect.getMetadata('http:param', UsersController.prototype, 'find', 0))
```

Compile and run again. The output is:

```
/users
/:id
id
```

The member metadata lives on `UsersController.prototype` under the member name. The parameter metadata lives in the same place, with the parameter index as the last argument.

## 6. Build the route table

Create `src/routes.ts`. It reads the prefix from the instance, walks the methods of the prototype and keeps the ones that have a route:

```ts
import { Reflect } from '@esliph/metadata'

export type Route = { path: string; method: string; params: string[] }

export function buildRoutes(controller: object): Route[] {
  const prefix = Reflect.getMetadata('http:prefix', controller) as string
  const prototype = Object.getPrototypeOf(controller)

  const routes: Route[] = []
  for (const method of Object.getOwnPropertyNames(prototype)) {
    const path = Reflect.getMetadata('http:get', prototype, method) as string | undefined
    if (path === undefined) continue

    const params = Array.from({ length: prototype[method].length }, (_, index) => Reflect.getMetadata('http:param', prototype, method, index) as string)

    routes.push({ path: prefix + path, method, params })
  }

  return routes
}
```

`getMetadata('http:prefix', controller)` receives an instance, not the class. Without a member name, the library reads the metadata of the instance's class.

Replace `src/main.ts`:

```ts
import { buildRoutes } from './routes'
import { UsersController } from './users.controller'

const controller = new UsersController()

console.log(buildRoutes(controller))
```

Compile and run. The output is:

```
[
  { path: '/users/', method: 'list', params: [] },
  { path: '/users/:id', method: 'find', params: [ 'id' ] }
]
```

## What you built

You wrote three decorators, attached metadata to a class, its methods and a method parameter, and read all of it back to build a route table. Along the way you saw that instance-member metadata exists only after the first instance is created.

## Next steps

- [Create custom decorators](../how-to/create-custom-decorators.md): typed helpers that write and read their own keys.
- [Metadata locations](../reference/metadata-locations.md): every combination of `target`, `propertyKey` and `parameterIndex`.
- [Decorators and initializers](../explanation/decorators-and-initializers.md): why instance-member metadata waits for an instance.
