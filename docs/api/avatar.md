# Avatar

Algorithm version: `grok-bot-0.70.2`.

```js
import { deriveDefaultAvatar, resolveAgentAvatar } from 'grok-bot-sdk'
```

`deriveDefaultAvatar(agentUuid)` needs no network. `resolveAgentAvatar(rawCloudAgent)` applies server fields on top of that default. `listBots` already calls `resolveAgentAvatar` for you.

## Which string is the key

Use the cloud record's `agentId`, the same UUID string `Bot.id` exposes.

The cloud field `id` is a different server record id. It is often a decimal string. Passing that decimal into `deriveDefaultAvatar` produces a real shape and color for that different key. It is not the avatar the client shows for the bot.

Keep the UUID as received. Do not strip hyphens, change case, trim, or run Unicode normalization. Swift code that round-trips through `UUID` and prints `uuidString` can change case and therefore change the avatar.

## Priority

1. A non-empty `avatarUrl` or `avatarDataUrl` sets `kind` to `picture` and `picture.url` to that string. `avatarUrl` wins when both are set.
2. A non-empty `avatarVersion` with neither URL still sets `kind` to `picture`, with `picture.url = null` and `picture.version` set. The image address has to come from elsewhere. This SDK does not invent it.
3. Shape is the server's `avatarShape` when it is in the valid shape list. Otherwise it is the derived shape.
4. Color is the server's `avatarColor` when it is in the palette. Otherwise it is the derived color.

A valid shape and a missing color combine. One bad field does not clear the other.

`sources.shape` and `sources.color` are `'explicit'` or `'id-default'`.

## Resolved object

```ts
interface ResolvedAvatar {
  algorithmVersion: 'grok-bot-0.70.2'
  kind: 'character' | 'picture'
  character: {
    shape: string
    color: string
    baseHex: string
    lightHex: string
    darkHex: string
  }
  sources: { shape: 'explicit' | 'id-default'; color: 'explicit' | 'id-default' }
  picture: { url: string | null; version: string | null } | null
}
```

`kind: 'character'` means `picture` is `null`. Render `character` in that case. For `picture`, prefer `picture.url` when it is a string, and keep `character` as the fallback artwork.

## Default pool

Shape index is `shapeHash % 8` after the mix below. The list order is the protocol:

| Index | Shape |
|---|---|
| 0 | `blob` |
| 1 | `pebble` |
| 2 | `squircle` |
| 3 | `tablet` |
| 4 | `wedge` |
| 5 | `hex` |
| 6 | `cloud` |
| 7 | `teardrop` |

Color index is `floor(random * 10)` into: `brown`, `red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `violet`, `magenta`, `gray`.

Black (`#000000`) is a valid explicit color and is not in the random pool. The editor's longer shape list is accepted as an explicit `avatarShape`: `bean`, `egg`, `capsule`, `cylinder`, `gem`, `crystal`, `shield`, `dome`, `arch`, `leaf`, `square`, `sparkle`, `clover`, `flower`, `heart`, `house`, `star`, plus the eight defaults.

80 default combinations do not give every bot a distinct avatar.

## Hash

The key is hashed as UTF-16 code units, which is what JavaScript `charCodeAt` returns, with FNV-1a and `Math.imul` so the multiply stays in 32 bits:

```js
let hash = 2166136261
for (let i = 0; i < key.length; i++) {
  hash = Math.imul(hash ^ key.charCodeAt(i), 16777619)
}
hash = hash >>> 0
```

Shape mix, starting from `hash | 0`:

```js
shapeHash = Math.imul(shapeHash ^ (shapeHash >>> 16), 73244475)
shapeHash = Math.imul(shapeHash ^ (shapeHash >>> 13), 3266489909)
shapeHash = (shapeHash ^ (shapeHash >>> 16)) >>> 0
```

Color uses two version salts that are both `1` in this client. They cancel, and the implementation still applies both so a later salt change has a place to land:

```js
const identitySeed = (hash ^ Math.imul(1, 2654435769)) >>> 0
let seed = (identitySeed ^ Math.imul(1, 2654435769)) >>> 0
seed = (seed + 1831565813) | 0
let sample = Math.imul(seed ^ (seed >>> 15), 1 | seed)
sample = (sample + Math.imul(sample ^ (sample >>> 7), 61 | sample)) ^ sample
const random = ((sample ^ (sample >>> 14)) >>> 0) / 4294967296
```

Ports to Python, Swift, or C have to use uint32 wraparound. A JavaScript `*` in place of `Math.imul` is a different function.

`test/fixtures/avatar-vectors.json` holds the vectors the tests check, including an ASCII uuid, the same uuid in uppercase, a decimal server id, and a non-BMP string. Uppercase and lowercase of one UUID are different rows on purpose.
