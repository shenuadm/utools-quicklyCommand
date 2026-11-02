<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import EmptyState from '../components/EmptyState.vue'
import { state, runGuarded } from '../stores/quickCommands.js'
import { fuzzyMatch } from '../core/fuzzy.js'
import { actionTypeIcon, actionTypeName } from '../core/actions.js'
import { utools } from '../api/env.js'

const keyword = ref('')
const activeIndex = ref(0)
const inputRef = ref(null)
const listRef = ref(null)

onMounted(async () => {
  await nextTick()
  if (inputRef.value) inputRef.value.focus()
})

const candidates = computed(() =>
  state.commands.filter((command) => command.enabled)
)

const results = computed(() => {
  const q = keyword.value.trim()
  if (!q) return candidates.value.slice(0, 50)
  return candidates.value
    .map((command) => {
      const byName = fuzzyMatch(q, command.name)
      const byDesc = fuzzyMatch(q, command.description || '')
      const byCategory = fuzzyMatch(q, command.category || '')
      const best = [byName, byDesc, byCategory].filter(Boolean).sort((a, b) => b.score - a.score)[0]
      return best ? { command, score: best.score } : null
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50)
    .map((entry) => entry.command)
})

watch(() => results.value.length, () => {
  activeIndex.value = 0
})

function move(step) {
  const total = results.value.length
  if (!total) return
  activeIndex.value = (activeIndex.value + step + total) % total
  scrollActiveIntoView()
}

function scrollActiveIntoView() {
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
  await runGuarded(command)
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
  <div class="launcher">
    <div class="search">
      <AppIcon name="search" :size="16" />
      <input
        ref="inputRef"
        v-model="keyword"
        class="search-input"
        placeholder="输入命令名称、描述或分类…"
        @keydown="onKeydown"
      />
      <span class="hint">{{ results.length }} 条</span>
    </div>

    <div ref="listRef" class="results scroll">
      <EmptyState
        v-if="!results.length"
        icon="search"
        :title="candidates.length ? '没有匹配的命令' : '还没有可执行的快命令'"
        :description="candidates.length ? '换个关键字试试' : '先在「快命令管理」里创建几条命令'"
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
        <span class="tag">{{ command.category }}</span>
        <span class="tag tag-accent">{{ actionTypeName(command.action?.type) }}</span>
      </button>
    </div>

    <footer class="foot">
      <span class="key">↑↓</span> 选择
      <span class="key">Enter</span> 执行
      <span class="key">Esc</span> 关闭
    </footer>
  </div>
</template>

<style scoped>
.launcher {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 0;
  background: var(--bg);
}

.search {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 14px 16px;
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
  font-size: 15px;
}

.hint {
  flex: none;
  font-size: 11.5px;
  color: var(--text-faint);
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

.foot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-faint);
}

.key {
  display: inline-flex;
  align-items: center;
  height: 17px;
  padding: 0 5px;
  margin-left: 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  font-size: 10px;
  color: var(--text-muted);
}

.key:first-child {
  margin-left: 0;
}
</style>
