/**
 * 全局状态仓库
 *
 * 用 Vue 的 reactive 实现，不引入 Pinia，保持插件依赖最小。
 * 所有写操作都会同步到 uTools 数据库，并触发动态功能对账。
 */

import { reactive, computed } from 'vue'
import {
  listCommands,
  listCategories,
  saveCommand,
  deleteCommand,
  saveCategory,
  deleteCategory,
  renameCategory as renameCategoryInDb,
  getCommand,
  UNCATEGORIZED
} from '../api/db.js'
import { getSettings, saveSettings, getRunLog, clearRunLog } from '../api/settings.js'
import { syncDynamicFeatures, clearDynamicFeatures } from '../api/dynamic-features.js'
import { runCommand } from '../core/runner.js'
import { defaultActionOf, actionUsesText, ACTION_TYPE_MAP } from '../core/actions.js'
import { readClipboardText } from '../api/env.js'
import { confirmDialog } from './useConfirm.js'
import { promptDialog } from './usePrompt.js'
import { toastSuccess, toastError } from './useToast.js'

export const state = reactive({
  ready: false,
  loading: false,
  commands: [],
  categories: [],
  settings: getSettings(),
  runLog: getRunLog(),
  /** 最近一次执行结果，用于「执行结果」抽屉 */
  lastResult: null,
  /** 初始化 / 存储相关的错误，直接显示在界面上，不要只丢进 console */
  initError: ''
})

/* ------------------------------------------------------------------ 派生 */

export const enabledCommands = computed(() => state.commands.filter((command) => command.enabled))

export const favoriteCommands = computed(() => state.commands.filter((command) => command.favorite))

export const categoryNames = computed(() => {
  const names = new Set(state.categories.map((category) => category.name))
  names.add(UNCATEGORIZED)
  return Array.from(names)
})

export const allTags = computed(() => {
  const tags = new Set()
  for (const command of state.commands) {
    for (const tag of command.tags) tags.add(tag)
  }
  return Array.from(tags).sort()
})

/* --------------------------------------------------------------- 载入 */

/** 从数据库重新载入全部数据 */
export function loadAll() {
  try {
    state.commands = listCommands()
    state.categories = listCategories()
    state.settings = getSettings()
    state.runLog = getRunLog()
    state.ready = true
  } catch (err) {
    const message = err && err.message ? err.message : String(err)
    state.initError = `读取数据失败：${message}`
    console.error('[store] 载入数据失败', err)
  }
  return state
}

/** 记录一个需要展示给用户的错误 */
export function setInitError(message) {
  state.initError = message || ''
}

/** 数据同步（来自其它设备）后重新载入 */
export function reloadFromCloud() {
  loadAll()
  syncFeatures()
}

/* --------------------------------------------------------------- 命令 */

function replaceCommand(next) {
  const index = state.commands.findIndex((command) => command.id === next.id)
  if (index === -1) {
    state.commands.unshift(next)
  } else {
    state.commands.splice(index, 1, next)
  }
  state.commands.sort((a, b) => a.order - b.order || b.updatedAt - a.updatedAt)
}

/**
 * 新建一条快命令。
 * @param {object} partial 命令内容
 */
export async function createCommand(partial = {}) {
  const action = { ...defaultActionOf(partial.action?.type), ...(partial.action || {}) }
  const now = Date.now()
  const command = saveCommand({
    name: partial.name || '新建快命令',
    description: partial.description || '',
    category: partial.category || state.settings.defaultCategory || UNCATEGORIZED,
    tags: partial.tags || [],
    icon: partial.icon || '⚡',
    action,
    options: partial.options || {},
    favorite: false,
    enabled: partial.enabled !== false,
    order: state.commands.length ? Math.min(...state.commands.map((c) => c.order)) - 1 : 1000,
    runCount: 0,
    lastRunAt: 0,
    createdAt: now,
    updatedAt: now
  })
  replaceCommand(command)
  syncFeatures()
  return command
}

/** 更新一条快命令 */
export async function updateCommand(command) {
  const next = saveCommand(command)
  replaceCommand(next)
  syncFeatures()
  return next
}

/** 删除一条快命令 */
export async function removeCommand(command) {
  const result = deleteCommand(command)
  if (result.ok) {
    state.commands = state.commands.filter((item) => item.id !== command.id)
    syncFeatures()
  } else {
    toastError(result.message || '删除失败')
  }
  return result
}

/** 启用 / 禁用 */
export async function toggleEnabled(command) {
  return updateCommand({ ...command, enabled: !command.enabled })
}

/** 收藏 / 取消收藏 */
export async function toggleFavorite(command) {
  return updateCommand({ ...command, favorite: !command.favorite })
}

/** 上移 / 下移 */
export async function moveCommand(command, direction) {
  const sorted = state.commands
    .slice()
    .sort((a, b) => a.order - b.order || b.updatedAt - a.updatedAt)
  const index = sorted.findIndex((item) => item.id === command.id)
  const target = index + (direction === 'up' ? -1 : 1)
  if (index === -1 || target < 0 || target >= sorted.length) {
    return command
  }

  // 先交换位置，再整体重排 order —— 避免两条命令 order 相同时交换失效
  const reordered = sorted.slice()
  const [moved] = reordered.splice(index, 1)
  reordered.splice(target, 0, moved)

  const base = Math.min(...reordered.map((item) => item.order), 1000)
  reordered.forEach((item, position) => {
    const nextOrder = base + position
    if (item.order === nextOrder) return
    const saved = saveCommand({ ...item, order: nextOrder })
    replaceCommand(saved)
  })
  state.commands.sort((a, b) => a.order - b.order || b.updatedAt - a.updatedAt)
  return state.commands.find((item) => item.id === command.id) || command
}

/* --------------------------------------------------------------- 分类 */

function replaceCategory(next) {
  const index = state.categories.findIndex((category) => category.id === next.id)
  if (index === -1) {
    state.categories.push(next)
  } else {
    state.categories.splice(index, 1, next)
  }
  state.categories.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
}

export async function createCategory(name) {
  const trimmed = String(name || '').trim()
  if (!trimmed) {
    toastError('分类名不能为空')
    return null
  }
  if (state.categories.some((category) => category.name === trimmed)) {
    toastError(`分类「${trimmed}」已存在`)
    return null
  }
  const category = saveCategory({
    name: trimmed,
    order: state.categories.length ? Math.max(...state.categories.map((c) => c.order)) + 1 : 1000,
    createdAt: Date.now()
  })
  replaceCategory(category)
  return category
}

export async function renameCategory(category, name) {
  const trimmed = String(name || '').trim()
  if (!trimmed) {
    toastError('分类名不能为空')
    return null
  }
  if (state.categories.some((item) => item.name === trimmed && item.id !== category.id)) {
    toastError(`分类「${trimmed}」已存在`)
    return null
  }
  const result = renameCategoryInDb(category, trimmed)
  if (!result.ok) {
    toastError(result.message || '重命名失败')
    return null
  }
  replaceCategory(result.category)
  loadAll()
  return result.category
}

export async function removeCategory(category) {
  const result = deleteCategory(category)
  if (result.ok) {
    state.categories = state.categories.filter((item) => item.id !== category.id)
    loadAll()
    toastSuccess(
      result.moved ? `已删除分类，${result.moved} 条命令移至「${UNCATEGORIZED}」` : '已删除分类'
    )
  } else {
    toastError(result.message || '删除失败')
  }
  return result
}

/* --------------------------------------------------------------- 设置 */

export function updateSettings(patch) {
  state.settings = saveSettings(patch)
  if ('registerFeatures' in patch) {
    syncFeatures()
  }
  return state.settings
}

export function resetRunLog() {
  clearRunLog()
  state.runLog = []
  toastSuccess('已清空运行记录')
}

/* --------------------------------------------------------- 动态功能对账 */

/** 把当前启用的快命令同步成 uTools 动态功能 */
export function syncFeatures() {
  const result = syncDynamicFeatures(state.commands, { register: state.settings.registerFeatures })
  if (result.failed && result.failed.length) {
    console.warn('[features] 部分动态功能同步失败', result.failed)
  }
  return result
}

/** 清理全部动态功能 */
export function removeAllFeatures() {
  const count = clearDynamicFeatures()
  toastSuccess(`已清理 ${count} 个动态功能`)
  return count
}

/* --------------------------------------------------------------- 执行 */

/**
 * 执行一条快命令。
 * @param {object} command 快命令
 * @param {{text?: string, selection?: string}} [context] 输入文本
 */
export async function executeCommand(command, context = {}) {
  try {
    const result = await runCommand(command, context)
    state.lastResult = { ...result, commandName: command.name }
    if (result.command) {
      replaceCommand(result.command)
    }
    if (!result.ok) {
      toastError(`${command.name}：${result.message}`)
    }
    return result
  } catch (err) {
    const message = err && err.message ? err.message : '执行失败'
    state.lastResult = { ok: false, message, output: '', error: message, commandName: command.name }
    toastError(`${command.name}：${message}`)
    return state.lastResult
  }
}

/** 重新读取某条命令（用于外部改动后刷新） */
export function refreshCommand(id) {
  const command = getCommand(id)
  if (command) replaceCommand(command)
  return command
}

/**
 * 带保护的执行：缺文本时询问、执行本地命令前确认。
 * 列表、命令面板、AI 工具都走这条路径。
 */
export async function runGuarded(command, context = {}) {
  const options = command.options || {}
  let text = context.text
  const selection = context.selection

  // 需要输入文本但拿不到 → 询问用户
  if (actionUsesText(command.action)) {
    const hasText = !!(text && text.length) || !!(options.useSelection && selection && selection.length)
    if (!hasText && options.useClipboard) {
      const clipboard = await readClipboardText()
      if (!text) text = clipboard
    }
    if (!text) {
      const input = await promptDialog({
        title: `「${command.name}」需要输入文本`,
        message: '请填写要处理的内容，模板中的 {{text}} 会使用这段文本。',
        placeholder: '输入文本…',
        multiline: true
      })
      if (input === null) {
        return { ok: false, message: '已取消', output: '', error: '' }
      }
      text = input
    }
  }

  // 执行本地命令 / 脚本前确认
  const meta = ACTION_TYPE_MAP[command.action?.type]
  if (state.settings.confirmBeforeRun && meta?.danger) {
    const detail = command.action.type === 'shell' ? command.action.command : command.action.code
    const confirmed = await confirmDialog({
      title: `确认执行「${command.name}」`,
      message: '该动作会在本机执行以下内容：',
      detail: String(detail ?? ''),
      confirmText: '执行',
      danger: true
    })
    if (!confirmed) {
      return { ok: false, message: '已取消', output: '', error: '' }
    }
  }

  return executeCommand(command, { text, selection })
}
