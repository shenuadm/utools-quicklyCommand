<script setup>
import { computed, ref, watch } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import CommandCard from '../components/CommandCard.vue'
import EmptyState from '../components/EmptyState.vue'
import { state, removeCommand, toggleEnabled, toggleFavorite, moveCommand, runGuarded, allTags } from '../stores/quickCommands.js'
import { fuzzyFilter } from '../core/fuzzy.js'
import { commandBody } from '../core/actions.js'
import { utools } from '../api/env.js'
import { confirmDialog } from '../stores/useConfirm.js'
import { toastSuccess, toastError } from '../stores/useToast.js'

const props = defineProps({
  category: { type: String, default: '' }
})

const emit = defineEmits(['edit', 'create'])

const keyword = ref('')
const tagFilter = ref('')
const favoritesOnly = ref(false)
const hotkeys = ref({})

function refreshHotkeys() {
  const map = {}
  for (const command of state.commands) {
    try {
      const key = utools.getCmdHotKey(command.name)
      if (key) map[command.id] = key
    } catch (err) {
      /* 忽略 */
    }
  }
  hotkeys.value = map
}

watch(
  () => state.commands.map((command) => `${command.id}:${command.name}`).join('|'),
  refreshHotkeys,
  { immediate: true }
)

const visible = computed(() => {
  let list = state.commands

  if (!state.settings.showDisabled) {
    list = list.filter((command) => command.enabled)
  }
  if (props.category) {
    list = list.filter((command) => command.category === props.category)
  }
  if (favoritesOnly.value) {
    list = list.filter((command) => command.favorite)
  }
  if (tagFilter.value) {
    list = list.filter((command) => command.tags.includes(tagFilter.value))
  }
  if (keyword.value.trim()) {
    list = fuzzyFilter(list, keyword.value.trim(), ['description', 'category'])
  }
  return list
})

/** 同名命令会出现在统计里，用来提示用户 */
const duplicateNames = computed(() => {
  const counter = new Map()
  for (const command of state.commands) {
    if (!command.enabled) continue
    counter.set(command.name, (counter.get(command.name) || 0) + 1)
  }
  return new Set(Array.from(counter.entries()).filter(([, count]) => count > 1).map(([name]) => name))
})

async function onRun(command) {
  await runGuarded(command)
}

/**
 * 复制命令的执行内容（保留 {{text}} 等模板原样），
 * 方便直接粘贴到终端、配置文件或聊天窗口里使用。
 */
function onCopy(command) {
  const body = commandBody(command)
  if (!body) {
    toastError(`「${command.name}」还没有配置可复制的内容`)
    return
  }
  const ok = utools.copyText(body)
  if (!ok) {
    toastError('复制失败')
    return
  }
  toastSuccess(`已复制「${command.name}」的命令内容`)
}

async function onRemove(command) {
  const confirmed = await confirmDialog({
    title: `删除「${command.name}」？`,
    message: '该命令将从 uTools 搜索框中移除，此操作不可撤销。',
    confirmText: '删除',
    danger: true
  })
  if (!confirmed) return
  await removeCommand(command)
  toastSuccess(`已删除「${command.name}」`)
}

function onHotkey(command) {
  try {
    utools.redirectHotKeySetting(command.name)
  } catch (err) {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="list-view">
    <div class="toolbar">
      <div class="search">
        <AppIcon name="search" :size="14" />
        <input v-model="keyword" class="search-input" placeholder="搜索名称、描述或分类…" />
        <button v-if="keyword" class="btn-icon" title="清空" @click="keyword = ''">
          <AppIcon name="close" :size="12" />
        </button>
      </div>
      <button
        class="btn btn-sm"
        :class="{ 'btn-primary': favoritesOnly }"
        title="只看收藏"
        @click="favoritesOnly = !favoritesOnly"
      >
        <AppIcon name="star" :size="13" />收藏
      </button>
      <button class="btn btn-sm btn-primary" @click="emit('create')">
        <AppIcon name="plus" :size="13" />新建
      </button>
    </div>

    <div v-if="allTags.length" class="tag-row">
      <button
        class="chip"
        :class="{ active: !tagFilter }"
        @click="tagFilter = ''"
      >
        全部标签
      </button>
      <button
        v-for="tag in allTags"
        :key="tag"
        class="chip"
        :class="{ active: tagFilter === tag }"
        @click="tagFilter = tagFilter === tag ? '' : tag"
      >
        #{{ tag }}
      </button>
    </div>

    <div class="list scroll">
      <div v-if="!visible.length" class="empty-wrap">
        <EmptyState
          icon="layers"
          :title="state.commands.length ? '没有匹配的命令' : '还没有快命令'"
          :description="
            state.commands.length
              ? '换个关键字或清除筛选条件试试'
              : '点击「新建」创建第一条快命令，例如把常用的网址、搜索或文本处理固化下来'
          "
        >
          <button v-if="!state.commands.length" class="btn btn-primary" @click="emit('create')">
            <AppIcon name="plus" :size="13" />新建快命令
          </button>
        </EmptyState>
      </div>

      <CommandCard
        v-for="command in visible"
        :key="command.id"
        :command="command"
        :duplicate="duplicateNames.has(command.name)"
        :hotkey="hotkeys[command.id] || ''"
        @run="onRun(command)"
        @copy="onCopy(command)"
        @edit="emit('edit', command)"
        @remove="onRemove(command)"
        @toggle="toggleEnabled(command)"
        @favorite="toggleFavorite(command)"
        @move-up="moveCommand(command, 'up')"
        @move-down="moveCommand(command, 'down')"
        @hotkey="onHotkey(command)"
      />
    </div>
  </div>
</template>

<style scoped>
.list-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px 8px;
}

.search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-faint);
}

.search:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 0 14px 8px;
}

.chip {
  height: 22px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  font-size: 11.5px;
  color: var(--text-muted);
}

.chip:hover {
  border-color: var(--border-strong);
}

.chip.active {
  background: var(--accent-soft);
  border-color: transparent;
  color: var(--accent);
}

.list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 14px 14px;
}

.empty-wrap {
  margin: auto 0;
}
</style>
