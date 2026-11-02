<script setup>
import { computed, ref } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import EmptyState from '../components/EmptyState.vue'
import { state, createCategory, renameCategory, removeCategory } from '../stores/quickCommands.js'
import { UNCATEGORIZED } from '../api/db.js'
import { confirmDialog } from '../stores/useConfirm.js'

const props = defineProps({
  active: { type: String, default: '' }
})

const emit = defineEmits(['select'])

const newName = ref('')
const editingId = ref('')
const editingName = ref('')

const counts = computed(() => {
  const map = new Map()
  for (const command of state.commands) {
    map.set(command.category, (map.get(command.category) || 0) + 1)
  }
  return map
})

const rows = computed(() => {
  const list = state.categories.map((category) => ({
    ...category,
    count: counts.value.get(category.name) || 0
  }))
  const uncategorized = counts.value.get(UNCATEGORIZED) || 0
  if (uncategorized > 0) {
    list.push({ id: '__uncategorized__', name: UNCATEGORIZED, count: uncategorized, fixed: true })
  }
  return list
})

async function add() {
  const name = newName.value.trim()
  if (!name) return
  const created = await createCategory(name)
  if (created) {
    newName.value = ''
  }
}

function startEdit(category) {
  editingId.value = category.id
  editingName.value = category.name
}

async function commitEdit(category) {
  const name = editingName.value.trim()
  editingId.value = ''
  if (!name || name === category.name) return
  await renameCategory(category, name)
}

async function remove(category) {
  const count = counts.value.get(category.name) || 0
  const confirmed = await confirmDialog({
    title: `删除分类「${category.name}」？`,
    message: count
      ? `该分类下有 ${count} 条命令，删除后它们会移到「${UNCATEGORIZED}」。`
      : '该分类还没有命令。',
    confirmText: '删除',
    danger: true
  })
  if (!confirmed) return
  await removeCategory(category)
  if (props.active === category.name) emit('select', '')
}
</script>

<template>
  <div class="category-view">
    <div class="toolbar">
      <div class="search">
        <AppIcon name="tag" :size="14" />
        <input
          v-model="newName"
          class="search-input"
          placeholder="新建分类名称"
          @keydown.enter="add"
        />
      </div>
      <button class="btn btn-sm btn-primary" @click="add">
        <AppIcon name="plus" :size="13" />新建分类
      </button>
    </div>

    <div class="list scroll">
      <EmptyState
        v-if="!rows.length"
        icon="tag"
        title="还没有分类"
        description="用分类把快命令组织起来，例如「搜索」「开发」「系统」"
      />

      <div
        v-for="row in rows"
        :key="row.id"
        class="row-item"
        :class="{ active: active === row.name }"
        @click="emit('select', active === row.name ? '' : row.name)"
      >
        <AppIcon name="tag" :size="14" />
        <template v-if="editingId === row.id">
          <input
            v-model="editingName"
            class="input inline-input"
            @click.stop
            @keydown.enter="commitEdit(row)"
            @keydown.esc="editingId = ''"
            @blur="commitEdit(row)"
          />
        </template>
        <template v-else>
          <span class="name grow truncate">{{ row.name }}</span>
          <span class="count">{{ row.count }}</span>
          <button
            v-if="!row.fixed"
            class="btn-icon"
            title="重命名"
            @click.stop="startEdit(row)"
          >
            <AppIcon name="edit" :size="14" />
          </button>
          <button
            v-if="!row.fixed"
            class="btn-icon"
            title="删除"
            @click.stop="remove(row)"
          >
            <AppIcon name="trash" :size="14" />
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.category-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.toolbar {
  display: flex;
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

.list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 14px 14px;
}

.row-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.row-item:hover {
  background: var(--bg-hover);
}

.row-item.active {
  background: var(--accent-soft);
  border-color: transparent;
  color: var(--accent);
}

.name {
  font-size: 13px;
  color: var(--text);
}

.row-item.active .name {
  color: var(--accent);
}

.count {
  font-size: 11.5px;
  color: var(--text-faint);
  background: var(--bg-sunken);
  border-radius: 999px;
  padding: 1px 7px;
}

.inline-input {
  height: 26px;
  padding: 0 8px;
  font-size: 13px;
}
</style>
