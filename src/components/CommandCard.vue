<script setup>
import { computed, onBeforeUnmount } from 'vue'
import AppIcon from './AppIcon.vue'
import { actionTypeName, actionTypeIcon } from '../core/actions.js'

const props = defineProps({
  command: { type: Object, required: true },
  duplicate: { type: Boolean, default: false },
  hotkey: { type: String, default: '' },
  busy: { type: Boolean, default: false }
})

const emit = defineEmits([
  'run',
  'copy',
  'edit',
  'remove',
  'toggle',
  'favorite',
  'move-up',
  'move-down',
  'hotkey'
])

const actionLabel = computed(() => actionTypeName(props.command.action?.type))
const actionIcon = computed(() => actionTypeIcon(props.command.action?.type))
const isDanger = computed(() => ['shell', 'script'].includes(props.command.action?.type))

/**
 * 单击执行与双击复制需要区分：单击先挂起一小段时间，
 * 若期间收到双击就取消执行改为复制。延迟短到几乎无感，
 * 但足以区分两种手势。
 */
const DOUBLE_CLICK_DELAY = 220
let runTimer = null

function onIconClick() {
  if (runTimer) clearTimeout(runTimer)
  runTimer = setTimeout(() => {
    runTimer = null
    emit('run')
  }, DOUBLE_CLICK_DELAY)
}

function onDoubleClick() {
  if (runTimer) {
    clearTimeout(runTimer)
    runTimer = null
  }
  emit('copy')
}

onBeforeUnmount(() => {
  if (runTimer) clearTimeout(runTimer)
})

const lastRunText = computed(() => {
  if (!props.command.lastRunAt) return '从未执行'
  const diff = Date.now() - props.command.lastRunAt
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '刚刚执行'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前执行`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前执行`
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前执行`
  return new Date(props.command.lastRunAt).toLocaleDateString('zh-CN')
})
</script>

<template>
  <div class="card" :class="{ disabled: !command.enabled }" @dblclick="onDoubleClick">
    <button
      class="icon-btn"
      :title="command.enabled ? '点击执行 · 双击复制命令内容' : '已禁用'"
      @click="onIconClick"
    >
      <span class="emoji">{{ command.icon || actionIcon }}</span>
    </button>

    <div class="body">
      <div class="title-row">
        <span class="name truncate" :title="`${command.name}（双击复制命令内容）`">
          {{ command.name }}
        </span>
        <span class="tag" :class="isDanger ? 'tag-warning' : 'tag-accent'">{{ actionLabel }}</span>
        <span v-if="duplicate" class="tag tag-danger" title="存在同名命令，在 uTools 搜索框中会同时出现">
          重名
        </span>
        <span v-if="!command.enabled" class="tag">已禁用</span>
      </div>
      <div class="meta-row">
        <span v-if="command.description" class="desc truncate">{{ command.description }}</span>
        <span class="tag">{{ command.category }}</span>
        <span v-for="tag in command.tags" :key="tag" class="tag">#{{ tag }}</span>
        <span class="stat">{{ command.runCount }} 次 · {{ lastRunText }}</span>
        <span v-if="hotkey" class="tag tag-accent">{{ hotkey }}</span>
        <span class="copy-hint">双击复制命令内容</span>
      </div>
    </div>

    <div class="actions" @dblclick.stop>
      <button class="btn-icon" title="复制命令内容（也可双击整行）" @click="emit('copy')">
        <AppIcon name="copy" :size="15" />
      </button>
      <button
        class="btn-icon"
        :class="{ starred: command.favorite }"
        :title="command.favorite ? '取消收藏' : '收藏'"
        @click="emit('favorite')"
      >
        <AppIcon name="star" :size="15" />
      </button>
      <button class="btn-icon" title="上移" @click="emit('move-up')">
        <AppIcon name="chevronUp" :size="15" />
      </button>
      <button class="btn-icon" title="下移" @click="emit('move-down')">
        <AppIcon name="chevronDown" :size="15" />
      </button>
      <button class="btn-icon" title="设置全局快捷键" @click="emit('hotkey')">
        <AppIcon name="keyboard" :size="15" />
      </button>
      <button class="btn-icon" title="编辑" @click="emit('edit')">
        <AppIcon name="edit" :size="15" />
      </button>
      <button class="btn-icon" title="删除" @click="emit('remove')">
        <AppIcon name="trash" :size="15" />
      </button>
      <label class="switch" :title="command.enabled ? '点击禁用' : '点击启用'">
        <input type="checkbox" :checked="command.enabled" @change="emit('toggle')" />
        <span class="knob"></span>
      </label>
    </div>
  </div>
</template>

<style scoped>
.card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.card:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-sm);
}

.card.disabled {
  opacity: 0.55;
}

.icon-btn {
  flex: none;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: var(--bg-sunken);
  font-size: 19px;
  line-height: 1;
  transition: background 0.15s, transform 0.1s;
}

.icon-btn:hover {
  background: var(--accent-soft);
  transform: scale(1.04);
}

.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text);
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 11.5px;
  color: var(--text-faint);
  flex-wrap: wrap;
}

.desc {
  max-width: 260px;
  color: var(--text-muted);
}

.stat {
  color: var(--text-faint);
  white-space: nowrap;
}

.copy-hint {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-faint);
  opacity: 0;
  transition: opacity 0.15s;
  white-space: nowrap;
}

.card:hover .copy-hint {
  opacity: 1;
}

.actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: none;
  opacity: 0.55;
  transition: opacity 0.15s;
}

.card:hover .actions {
  opacity: 1;
}

.btn-icon.starred {
  color: var(--warning);
}

.btn-icon.starred :deep(path) {
  fill: var(--warning);
}
</style>
