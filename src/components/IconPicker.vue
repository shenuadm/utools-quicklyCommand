<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

const EMOJIS = [
  '⚡', '🔍', '🌐', '🔗', '📂', '📄', '📋', '🗂', '🖥', '⌨️', '🧰', '🔧', '🛠', '⚙️', '🧪', '📜',
  '🚀', '💡', '🎯', '🏁', '⭐', '❤️', '🔥', '✨', '🎨', '📦', '📥', '📤', '🗃', '🗄', '💾', '🧹',
  '📝', '📓', '📔', '📚', '🔖', '🏷', '🔢', '🔤', '🅰️', '🆔', '💬', '💭', '🗣', '📢', '🔔', '📣',
  '🎵', '🎬', '📷', '🎨', '🖼', '🕐', '📅', '⏰', '⏳', '🔁', '🔄', '↩️', '⬆️', '⬇️', '↔️', '🔀',
  '💻', '🖥', '🗄', '📱', '⌨️', '🖱', '💽', '📀', '🔌', '🔋', '🪫', '🧮', '📈', '📉', '🗺', '🧭',
  '🏠', '🏢', '🏥', '🏦', '🏫', '🏨', '🛒', '🛍', '💰', '💳', '🧾', '🎁', '🎈', '🎉', '🎊', '✨',
  '🍎', '🍊', '🍋', '🍉', '🍇', '🍓', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🍕', '🍔', '🍟',
  '☕', '🍵', '🍺', '🍻', '🥂', '🍷', '🧋', '🧃', '🥤', '🍺', '🧊', '🍩', '🍪', '🎂', '🍫', '🍬',
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈',
  '🌸', '🌹', '🌺', '🌻', '🌼', '🌷', '🌱', '🌲', '🌳', '🍀', '🍁', '🍂', '🍃', '🌾', '🌊', '🔥'
]

const keyword = ref('')
const open = ref(false)

/** 可写的代理，props 本身不能直接 v-model */
const value = computed({
  get: () => props.modelValue,
  set: (next) => emit('update:modelValue', next)
})

const filtered = computed(() => {
  const q = keyword.value.trim()
  if (!q) return EMOJIS
  return EMOJIS.filter((emoji) => emoji.includes(q))
})

function pick(emoji) {
  emit('update:modelValue', emoji)
  open.value = false
}
</script>

<template>
  <div class="picker">
    <div class="picker-head">
      <button class="preview" type="button" @click="open = !open">
        <span class="preview-emoji">{{ modelValue || '⚡' }}</span>
        <span class="preview-text">选择图标</span>
      </button>
      <input
        v-model="value"
        class="input"
        placeholder="也可以直接输入 Emoji"
        maxlength="8"
      />
    </div>

    <Transition name="fade">
      <div v-if="open" class="picker-pop">
        <input v-model="keyword" class="input picker-search" placeholder="筛选…" />
        <div class="picker-grid scroll">
          <button
            v-for="emoji in filtered"
            :key="emoji"
            type="button"
            class="picker-item"
            :class="{ active: emoji === modelValue }"
            @click="pick(emoji)"
          >
            {{ emoji }}
          </button>
        </div>
        <p v-if="!filtered.length" class="picker-empty">没有匹配的图标</p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.picker-head {
  display: flex;
  gap: 8px;
  align-items: center;
}

.preview {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 11px;
  flex: none;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
}

.preview:hover {
  border-color: var(--border-strong);
}

.preview-emoji {
  font-size: 16px;
}

.preview-text {
  font-size: 12.5px;
  color: var(--text-muted);
}

.picker-pop {
  margin-top: 8px;
  padding: 10px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-sm);
}

.picker-search {
  margin-bottom: 8px;
}

.picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(34px, 1fr));
  gap: 3px;
  max-height: 168px;
  overflow-y: auto;
}

.picker-item {
  height: 32px;
  border-radius: var(--radius-sm);
  font-size: 17px;
  line-height: 1;
}

.picker-item:hover {
  background: var(--bg-hover);
}

.picker-item.active {
  background: var(--accent-soft);
  outline: 1px solid var(--accent);
}

.picker-empty {
  margin: 8px 0 0;
  text-align: center;
  font-size: 12px;
  color: var(--text-faint);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
