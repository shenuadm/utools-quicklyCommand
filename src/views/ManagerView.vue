<script setup>
import { computed, ref, watch } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import CommandListView from './CommandListView.vue'
import CategoryView from './CategoryView.vue'
import StatsView from './StatsView.vue'
import SettingsView from './SettingsView.vue'
import CommandEditorDrawer from './CommandEditorDrawer.vue'
import ResultDrawer from '../components/ResultDrawer.vue'
import { state, categoryNames, loadAll, syncFeatures } from '../stores/quickCommands.js'
import { seedDefaults } from '../api/seed.js'
import { confirmDialog } from '../stores/useConfirm.js'
import { toastSuccess, toastError } from '../stores/useToast.js'

const props = defineProps({
  /** 打开时自动切换到的页面 */
  initialTab: { type: String, default: 'commands' },
  /** 打开时自动执行导入 */
  autoImport: { type: Boolean, default: false },
  /** 打开时自动执行导出 */
  autoExport: { type: Boolean, default: false }
})

const emit = defineEmits(['import-request'])

const tab = ref(props.initialTab)
const category = ref('')
const editorOpen = ref(false)
const editingCommand = ref(null)

const autoAction = computed(() => {
  if (props.autoImport) return 'import'
  if (props.autoExport) return 'export'
  return ''
})

watch(
  () => props.initialTab,
  (value) => {
    tab.value = value
  }
)

const NAV = [
  { id: 'commands', label: '命令列表', icon: 'layers' },
  { id: 'categories', label: '分类', icon: 'tag' },
  { id: 'stats', label: '统计', icon: 'chart' },
  { id: 'settings', label: '设置', icon: 'settings' }
]

const counts = computed(() => {
  const map = new Map()
  for (const command of state.commands) {
    map.set(command.category, (map.get(command.category) || 0) + 1)
  }
  return map
})

function openCreate() {
  editingCommand.value = null
  editorOpen.value = true
}

function openEdit(command) {
  editingCommand.value = command
  editorOpen.value = true
}

function closeEditor() {
  editorOpen.value = false
  editingCommand.value = null
}

/** 重新载入数据（存储出问题时用来重试） */
async function reload() {
  loadAll()
  syncFeatures()
  if (state.commands.length) {
    state.initError = ''
    toastSuccess(`已重新载入，共 ${state.commands.length} 条快命令`)
  } else {
    toastError('仍然没有读到任何快命令')
  }
}

/** 重新写入示例命令（数据库空且初始化失败时的自愈手段） */
async function repair() {
  const confirmed = await confirmDialog({
    title: '重新写入示例命令？',
    message: '会写入一组示例快命令与「搜索 / 文本 / 系统」分类，不会删除你已有的命令。',
    confirmText: '写入'
  })
  if (!confirmed) return
  const result = seedDefaults()
  loadAll()
  syncFeatures()
  if (result.errors && result.errors.length) {
    state.initError = `示例命令写入失败：${result.errors.join('；')}`
    toastError('写入失败，请把上面的错误信息反馈给开发者')
  } else {
    state.initError = ''
    toastSuccess(`已写入 ${result.added} 条示例命令`)
  }
}
</script>

<template>
  <div class="manager">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-logo">⚡</span>
        <div class="brand-text">
          <p class="brand-name">快命令管理</p>
          <p class="brand-sub">{{ state.commands.length }} 条快命令</p>
        </div>
      </div>

      <nav class="nav">
        <button
          v-for="item in NAV"
          :key="item.id"
          class="nav-item"
          :class="{ active: tab === item.id }"
          @click="tab = item.id"
        >
          <AppIcon :name="item.icon" :size="15" />
          <span class="grow truncate">{{ item.label }}</span>
          <span v-if="item.id === 'commands'" class="nav-count">{{ state.commands.length }}</span>
        </button>
      </nav>

      <template v-if="tab === 'commands'">
        <p class="nav-title">分类</p>
        <nav class="nav">
          <button
            class="nav-item small"
            :class="{ active: category === '' }"
            @click="category = ''"
          >
            <AppIcon name="layers" :size="13" />
            <span class="grow truncate">全部命令</span>
            <span class="nav-count">{{ state.commands.length }}</span>
          </button>
          <button
            v-for="name in categoryNames"
            :key="name"
            class="nav-item small"
            :class="{ active: category === name }"
            @click="category = name"
          >
            <AppIcon name="tag" :size="13" />
            <span class="grow truncate">{{ name }}</span>
            <span class="nav-count">{{ counts.get(name) || 0 }}</span>
          </button>
        </nav>
      </template>

      <div class="sidebar-foot">
        <button class="btn btn-sm btn-primary" @click="openCreate">
          <AppIcon name="plus" :size="13" />新建快命令
        </button>
      </div>
    </aside>

    <main class="content">
      <div v-if="state.initError" class="init-error">
        <AppIcon name="info" :size="15" />
        <div class="grow">
          <p class="init-error-title">数据读写出现问题</p>
          <p class="init-error-detail">{{ state.initError }}</p>
        </div>
        <button class="btn btn-sm" @click="reload">重新载入</button>
        <button v-if="!state.commands.length" class="btn btn-sm btn-primary" @click="repair">
          写入示例命令
        </button>
      </div>

      <CommandListView
        v-if="tab === 'commands'"
        :category="category"
        @edit="openEdit"
        @create="openCreate"
      />
      <CategoryView v-else-if="tab === 'categories'" :active="category" @select="category = $event" />
      <StatsView v-else-if="tab === 'stats'" />
      <SettingsView
        v-else
        :auto-action="autoAction"
        @action-done="emit('import-request')"
      />
    </main>

    <ResultDrawer />

    <CommandEditorDrawer
      :open="editorOpen"
      :command="editingCommand"
      @close="closeEditor"
    />
  </div>
</template>

<style scoped>
.manager {
  display: flex;
  height: 100vh;
  min-height: 0;
}

.sidebar {
  width: 196px;
  flex: none;
  display: flex;
  flex-direction: column;
  padding: 12px 10px;
  border-right: 1px solid var(--border);
  background: var(--bg-sunken);
  overflow-y: auto;
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 4px 6px 12px;
}

.brand-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 9px;
  background: var(--accent-soft);
  font-size: 17px;
}

.brand-text {
  min-width: 0;
}

.brand-name {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
}

.brand-sub {
  margin: 0;
  font-size: 11px;
  color: var(--text-faint);
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.nav-title {
  margin: 14px 8px 5px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-faint);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: 13px;
  text-align: left;
  transition: background 0.14s, color 0.14s;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.nav-item.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.nav-item.small {
  padding: 5px 8px;
  font-size: 12.5px;
}

.nav-count {
  flex: none;
  font-size: 10.5px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}

.nav-item.active .nav-count {
  color: var(--accent);
}

.sidebar-foot {
  margin-top: auto;
  padding-top: 12px;
}

.sidebar-foot .btn {
  width: 100%;
}

.content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  position: relative;
}

.init-error {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 14px 0;
  padding: 10px 12px;
  border-radius: var(--radius);
  border: 1px solid var(--danger-soft);
  background: var(--danger-soft);
  color: var(--danger);
}

.init-error-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.init-error-detail {
  margin: 2px 0 0;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--text-muted);
  word-break: break-word;
}
</style>
