## Local Effect Source

The Effect repository is using a new beta version cloned to `.repos/effect-smol`
for reference. Use this to explore APIs, find usage examples, and understand
implementation details when the documentation isn't enough.

## Formatting and Linting

Always format and lint your code with `pnpm fmt` and `pnpm lint:fix` in the
correct project. When changing Effect-heavy TypeScript, also run patched
TypeScript with `pnpm exec tsc -p tsconfig.json --noEmit` in that project to
surface Effect language-service diagnostics.

## Effect Usage

When writing complex TypeScript logic prefer leveraging as many Effect-native
implemenations as possible. Never use JSON.stringify or JSON.parse in order to
handle data, always use Effect Schema.
