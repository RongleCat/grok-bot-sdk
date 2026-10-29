# 头像

算法版本：`grok-bot-0.70.2`。在 Grok Bot 0.75.8 和 0.78.1 里又核对过：哈希、盐值、默认形状和调色板没有变。`pumpkin` 是额外的显式形状，默认哈希不会选中它。

```js
import { deriveDefaultAvatar, resolveAgentAvatar } from 'grok-bot-sdk'
```

`deriveDefaultAvatar(agentUuid)` 不需要网络。`resolveAgentAvatar(rawCloudAgent)` 在这个默认值之上应用服务端字段。`listBots` 已经替你调用了 `resolveAgentAvatar`。

## 哪一个字符串才是钥匙

使用云端记录的 `agentId`，也就是 `Bot.id` 暴露的那个 UUID 字符串。

云端字段 `id` 是另一套服务端记录 ID。它常常是十进制字符串。把这个十进制数放进 `deriveDefaultAvatar`，会为这把不同的钥匙算出真实的形状和颜色。那不是客户端为这个 Bot 显示的头像。

UUID 按收到的原文使用。不要去掉连字符、改变大小写、trim，或做 Unicode 规范化。Swift 若先转成 `UUID` 再打印 `uuidString`，可能改变大小写，从而改变头像。

## 优先级

1. 非空的 `avatarUrl` 或 `avatarDataUrl` 把 `kind` 设为 `picture`，并把 `picture.url` 设为该字符串。两者都有时，`avatarUrl` 优先。
2. 只有非空的 `avatarVersion`、没有 URL 时，`kind` 仍是 `picture`，`picture.url` 为 `null`，`picture.version` 有值。图片地址要到别处去取。这个 SDK 不编造它。
3. 服务端的 `avatarShape` 在有效形状列表里时，形状用它。否则用推算形状。
4. 服务端的 `avatarColor` 在调色板里时，颜色用它。否则用推算颜色。

有效形状可以和缺失的颜色组合。一个坏字段不会清掉另一个。

`sources.shape` 和 `sources.color` 是 `'explicit'` 或 `'id-default'`。

## 解析结果

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

`kind: 'character'` 时 `picture` 为 `null`。这时渲染 `character`。`picture` 时，`picture.url` 是字符串就优先用它，并保留 `character` 作为备用图形。

## 默认池

形状下标是下面这轮混合之后的 `shapeHash % 8`。列表顺序是协议的一部分：

| 下标 | 形状 |
|---|---|
| 0 | `blob` |
| 1 | `pebble` |
| 2 | `squircle` |
| 3 | `tablet` |
| 4 | `wedge` |
| 5 | `hex` |
| 6 | `cloud` |
| 7 | `teardrop` |

颜色下标是 `floor(random * 10)`，顺序为：`brown`、`red`、`orange`、`yellow`、`green`、`cyan`、`blue`、`violet`、`magenta`、`gray`。

黑色（`#000000`）是合法的显式颜色，不在随机池里。编辑器更长的形状列表可以作为显式 `avatarShape`：`bean`、`egg`、`capsule`、`cylinder`、`gem`、`crystal`、`shield`、`dome`、`arch`、`leaf`、`square`、`sparkle`、`clover`、`flower`、`heart`、`house`、`star`，再加上默认的八种。

80 种默认组合不能让每个 Bot 的头像都不同。

## 哈希

钥匙按 UTF-16 码元哈希，也就是 JavaScript `charCodeAt` 的返回值。算法是 FNV-1a，乘法用 `Math.imul`，结果留在 32 位里：

```js
let hash = 2166136261
for (let i = 0; i < key.length; i++) {
  hash = Math.imul(hash ^ key.charCodeAt(i), 16777619)
}
hash = hash >>> 0
```

形状混合从 `hash | 0` 开始：

```js
shapeHash = Math.imul(shapeHash ^ (shapeHash >>> 16), 73244475)
shapeHash = Math.imul(shapeHash ^ (shapeHash >>> 13), 3266489909)
shapeHash = (shapeHash ^ (shapeHash >>> 16)) >>> 0
```

颜色使用两个版本盐，在这个客户端里都是 `1`。它们会互相抵消。实现仍然两步都做，这样以后盐值变化时有地方改：

```js
const identitySeed = (hash ^ Math.imul(1, 2654435769)) >>> 0
let seed = (identitySeed ^ Math.imul(1, 2654435769)) >>> 0
seed = (seed + 1831565813) | 0
let sample = Math.imul(seed ^ (seed >>> 15), 1 | seed)
sample = (sample + Math.imul(sample ^ (sample >>> 7), 61 | sample)) ^ sample
const random = ((sample ^ (sample >>> 14)) >>> 0) / 4294967296
```

移植到 Python、Swift 或 C 时必须按 uint32 回绕。用 JavaScript 的 `*` 代替 `Math.imul` 是另一个函数。

`test/fixtures/avatar-vectors.json` 保存测试核对的向量，包括一个 ASCII UUID、同一个 UUID 的大写形式、一个十进制服务端 ID，以及一个非 BMP 字符串。同一个 UUID 的大小写是不同的行，这是有意的。
