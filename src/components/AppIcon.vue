<script setup>
/**
 * 内联 SVG 图标
 * 统一 stroke 风格，避免引入图标库依赖。
 */
const props = defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 16 },
  strokeWidth: { type: Number, default: 1.8 }
})

const PATHS = {
  search: ['M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M21 21l-4.4-4.4'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  edit: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z'],
  trash: ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6', 'M10 11v6', 'M14 11v6'],
  star: ['M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z'],
  play: ['M7 4l12 8-12 8z'],
  settings: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'
  ],
  folder: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  chart: ['M3 3v18h18', 'M7 15v3', 'M12 9v9', 'M17 5v13'],
  chevronUp: ['M6 15l6-6 6 6'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronRight: ['M9 6l6 6-6 6'],
  copy: ['M9 9h11v11H9z', 'M15 9V4H4v11h5'],
  check: ['M20 6L9 17l-5-5'],
  close: ['M18 6L6 18', 'M6 6l12 12'],
  import: ['M12 3v12', 'M7 10l5 5 5-5', 'M4 20h16'],
  export: ['M12 21V9', 'M7 14l5-5 5 5', 'M4 4h16'],
  link: [
    'M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.2 1.2',
    'M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.2-1.2'
  ],
  terminal: ['M4 17l6-5-6-5', 'M12 19h8'],
  code: ['M9 18l-6-6 6-6', 'M15 6l6 6-6 6'],
  globe: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M3 12h18', 'M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z'],
  text: ['M4 7V5h16v2', 'M12 5v14', 'M9 19h6'],
  keyboard: ['M3 6h18v12H3z', 'M7 10h.01', 'M11 10h.01', 'M15 10h.01', 'M7 14h10'],
  refresh: ['M21 12a9 9 0 1 1-2.64-6.36', 'M21 3v6h-6'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  filter: ['M3 5h18l-7 8v6l-4 2v-8z'],
  power: ['M12 3v9', 'M18.36 6.64a9 9 0 1 1-12.73 0'],
  sun: [
    'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M12 1v2', 'M12 21v2', 'M4.2 4.2l1.4 1.4', 'M18.4 18.4l1.4 1.4', 'M1 12h2', 'M21 12h2', 'M4.2 19.8l1.4-1.4', 'M18.4 5.6l1.4-1.4'
  ],
  moon: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'],
  tag: ['M20.6 13.4L12 22l-9-9V4h9z', 'M7.5 7.5h.01'],
  layers: ['M12 2l9 5-9 5-9-5z', 'M3 12l9 5 9-5', 'M3 17l9 5 9-5'],
  bell: ['M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8', 'M13.7 21a2 2 0 0 1-3.4 0'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5', 'M12 8h.01']
}

const paths = PATHS[props.name] || PATHS.info
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="app-icon"
  >
    <path v-for="(d, index) in paths" :key="index" :d="d" />
  </svg>
</template>

<style scoped>
.app-icon {
  flex: none;
  display: block;
}
</style>
