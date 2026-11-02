<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import EmptyState from '../components/EmptyState.vue'
import { state, runGuarded } from '../stores/quickCommands.js'
import { actionUsesText, actionTypeIcon, actionTypeName } from '../core/actions.js'
import { utools } from '../api/env.js'

const props = defineProps({
  /** 来自超级面板的选中文本 */
  text: { type: String, default: '' }
})

const keyword = ref('')
const activeIndex = ref(0)
const inputRef = ref(null)
const listRef = ref(null)

onMounted(async () => {
  await nextTick()
  if (inputRef.value) inputRef.value.focus()
})

/** 只列出真正会消费文本的快命令 */
const candidates = computed(() =>
  state.commands.filter(
    (command) => command.enabled && actionUsesText(command.action)
  )
)

const results = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return candidates.value
  return candidates.value.filter((command) =>
    [command.name, command.description, command.category, ...command.tags]
      .join(' ')
      .toLowerCase()
      .includes(q)
  )
})

watch(
  () => results.value.length,
  () => {
    activeIndex.value = 0
  }
)

const preview = computed(() => {
  const value = props.text || ''
  if (value.length <= 220) return value
  return `${value.slice(0, 220)}…`
})

function move(step) {
  const total = results.value.length
  if (!total) return
  activeIndex.value = (activeIndex.value + step + total) % total
  nextTick(() => {
    const list = listRef.value
    const item = list?.querySelector('.result-item.active')
    if (item && list) {
      const top = item.offsetTop
      const bottom = top + item.offsetHeight
      if (top < list.scrollTop) list.scrollTop = top
      else if (bottom > list.scrollTop + list.clientHeight) {
        list.scrollTop = bottom - list.clientHeight
      }
    }
  })
}

async function run(command) {
  if (!command) return
  await runGuarded(command, { text: props.text })
  try {
    utools.outPlugin()
  } catch (err) {
    /* 浏览器预览环境下忽略 */
  }
}

function onKeydown(event) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    move(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    move(-1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    run(results.value[activeIndex.value])
  } else if (event.key === 'Escape') {
    try {
      utools.outPlugin()
    } catch (err) {
      /* 忽略 */
    }
  }
}
</script>

<template>
  <div class="picker-view">
    <header class="head">
      <div class="head-row">
        <AppIcon name="text" :size="15" />
        <span class="head-title">用快命令处理选中的文本</span>
        <span class="tag">{{ props.text.length }} 字</span>
      </div>
      <pre class="preview scroll">{{ preview }}</pre>
    </header>

    <div class="search">
      <AppIcon name="search" :size="14" />
      <input
        ref="inputRef"
        v-model="keyword"
        class="search-input"
        placeholder="筛选可用的快命令…"
        @keydown="onKeydown"
      />
    </div>

    <div ref="listRef" class="results scroll">
      <EmptyState
        v-if="!results.length"
        icon="text"
        :title="candidates.length ? '没有匹配的命令' : '还没有处理文本的快命令'"
        :description="
          candidates.length
            ? '换个关键字试试'
            : '在「快命令管理」里创建一条「文本处理」或「搜索」类命令即可'
        "
      />

      <button
        v-for="(command, index) in results"
        :key="command.id"
        class="result-item"
        :class="{ active: index === activeIndex }"
        @mouseenter="activeIndex = index"
        @click="run(command)"
      >
        <span class="result-icon">{{ command.icon || actionTypeIcon(command.action?.type) }}</span>
        <span class="result-body">
          <span class="result-name truncate">{{ command.name }}</span>
          <span v-if="command.description" class="result-desc truncate">
            {{ command.description }}
          </span>
        </span>
        <span class="tag tag-accent">{{ actionTypeName(command.action?.type) }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.picker-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 0;
  background: var(--bg);
}

.head {
  padding: 12px 14px 8px;
  border-bottom: 1px solid var(--border);
}

.head-row {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 8px;
  color: var(--text-muted);
}

.head-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.preview {
  max-height: 88px;
  margin: 0;
  padding: 9px 11px;
  border-radius: var(--radius-sm);
  background: var(--bg-sunken);
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-muted);
  overflow: auto;
}

.search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-bottom: 1px solid var(--border);
  color: var(--text-faint);
}

.search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
}

.results {
  flex: 1;
  min-height: 0;
  padding: 6px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  text-align: left;
  color: var(--text);
}

.result-item.active {
  background: var(--accent-soft);
}

.result-icon {
  flex: none;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: var(--bg-sunken);
  font-size: 15px;
}

.result-item.active .result-icon {
  background: var(--bg-elevated);
}

.result-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.result-name {
  font-size: 13.5px;
  font-weight: 500;
}

.result-desc {
  font-size: 11.5px;
  color: var(--text-faint);
}
</style>
