<script setup lang="ts">
defineProps<{
  label: string
}>()

const pieces = [
  { shape: 'cloud', fill: '#FF6700', x: '0%', y: '10%', size: '42%', rot: -12, z: 2 },
  { shape: 'hex', fill: '#00C972', x: '60%', y: '0%', size: '34%', rot: 9, z: 1 },
  { shape: 'teardrop', fill: '#9159FE', x: '28%', y: '2%', size: '36%', rot: -5, z: 4 },
  { shape: 'squircle', fill: '#1084FE', x: '58%', y: '34%', size: '40%', rot: 8, z: 3 },
  { shape: 'pebble', fill: '#FF263C', x: '2%', y: '50%', size: '32%', rot: 12, z: 3 },
  { shape: 'blob', fill: '#000000', x: '30%', y: '50%', size: '36%', rot: -8, z: 5, invert: true },
  { shape: 'wedge', fill: '#FF309B', x: '66%', y: '64%', size: '30%', rot: -12, z: 4 },
  { shape: 'capsule', fill: '#00BCA6', x: '6%', y: '72%', size: '26%', rot: 20, z: 2 },
]

const paths: Record<string, string> = {
  blob: 'M50 8a42 42 0 1 1 0 84a42 42 0 0 1 0-84z',
  squircle: 'M22 14h56a22 22 0 0 1 22 22v28a22 22 0 0 1-22 22H22A22 22 0 0 1 0 64V36A22 22 0 0 1 22 14z',
  cloud: 'M24 64c-10 0-14-10-8-16c-6-10 2-22 14-18c4-12 22-16 32-6c12-8 28 2 24 16c12 2 14 18 4 24c-2 12-16 16-28 10c-8 10-28 8-38-10z',
  teardrop: 'M50 6C72 28 94 46 86 68C78 92 60 98 50 98C40 98 22 92 14 68C6 46 28 28 50 6z',
  hex: 'M50 6L88 28V72L50 94L12 72V28z',
  pebble: 'M50 28C76 22 98 40 94 58C100 80 74 96 50 92C24 98 4 78 10 56C2 36 26 24 50 28z',
  wedge: 'M50 10L88 78Q92 94 74 94H26Q8 94 12 78Z',
  capsule: 'M36 6H64A18 18 0 0 1 64 94H36A18 18 0 0 1 36 6Z',
}

function styleOf(piece: (typeof pieces)[number]) {
  return {
    left: piece.x,
    top: piece.y,
    width: piece.size,
    zIndex: piece.z,
    transform: `rotate(${piece.rot}deg)`,
  }
}
</script>

<template>
  <div class="hero-avatars" role="img" :aria-label="label">
    <svg
      v-for="piece in pieces"
      :key="piece.shape"
      class="hero-avatar"
      :class="{ 'is-default': piece.invert }"
      :style="styleOf(piece)"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <path class="body" :d="paths[piece.shape]" :fill="piece.fill" :stroke="piece.fill" stroke-width="5" stroke-linejoin="round" />
      <g :clip-path="`url(#hero-avatar-${piece.shape})`">
        <ellipse class="shine" cx="74" cy="42" rx="11" ry="16" />
        <g class="face" transform="translate(50 36)">
          <rect x="0" y="0" width="8" height="18" rx="4" />
          <rect x="13" y="2" width="7" height="16" rx="3.6" transform="rotate(16 16.5 10)" />
        </g>
      </g>
      <defs>
        <clipPath :id="`hero-avatar-${piece.shape}`">
          <path :d="paths[piece.shape]" />
        </clipPath>
      </defs>
    </svg>
  </div>
</template>
