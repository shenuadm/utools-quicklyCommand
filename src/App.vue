<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import ManagerView from './views/ManagerView.vue'
import LauncherView from './views/LauncherView.vue'
import TextPickerView from './views/TextPickerView.vue'
import ToastHost from './components/ToastHost.vue'
import ConfirmHost from './components/ConfirmHost.vue'
import PromptHost from './components/PromptHost.vue'
import { state, loadAll, syncFeatures, runGuarded, reloadFromCloud } from './stores/quickCommands.js'
import { utools } from './api/env.js'
import { getCommand } from './api/db.js'
import { commandIdOfFeatureCode } from './api/dynamic-features.js'
import { recordPush, takePush } from './api/push-index.js'
import { fuzzyMatch } from './core/fuzzy.js'
import { featureIcon } from './core/command-icon.js'

/** manager | launcher | text */
const view = ref('manager')
const managerTab = ref('commands')
const ioAction = ref('')
const textPayload = ref('')

/* ------------------------------------------------------------------ 主题 */

function systemPrefersDark() {
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolveDark() {
  const mode = state.settings.theme || 'auto'
  if (mode === 'dark') return true
  if (mode === 'light') return false
  try {
    if (typeof utools.isDarkColors === 'function') return !!utools.isDarkColors()
  } catch (err) {
    /* 忽略 */
  }
  return systemPrefersDark()
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', resolveDark() ? 'dark' : 'light')
}

watch(() => state.settings.theme, applyTheme)

/* -------------------------------------------------------------- 视图高度 */

const HEIGHTS = { manager: 640, launcher: 460, text: 540 }

watch(view, (value) => {
  try {
    utools.setExpandHeight(HEIGHTS[value] || 640)
  } catch (err) {
    /* 浏览器预览环境下忽略 */
  }
})

/* -------------------------------------------------------------- 执行入口 */

async function executeById(id, text) {
  const command = getCommand(id)
  if (!command) return false
  await runGuarded(command, { text })
  return true
}

async function handleEnter(action) {
  const code = action.code || ''

  // 来自搜索框推送的结果：option.text 里带回被选中的推送项
  if (action.option && action.option.text) {
    const entry = takePush(action.option.text)
    if (entry) {
      const ran = await executeById(entry.commandId, entry.keyword)
      if (ran) {
        view.value = 'manager'
        return
      }
    }
  }

  if (code === 'qc-launcher') {
    view.value = 'launcher'
    return
  }

  if (code === 'qc-text') {
    textPayload.value = typeof action.payload === 'string' ? action.payload : ''
    view.value = 'text'
    return
  }

  if (code === 'qc-io') {
    ioAction.value = action.payload === '导出快命令' ? 'export' : 'import'
    managerTab.value = 'settings'
    view.value = 'manager'
    return
  }

  if (code.startsWith('qc-run-')) {
    const id = commandIdOfFeatureCode(code)
    const command = getCommand(id)
    if (command) {
      // 匹配指令的 payload 就是选中的文本；功能指令的 payload 是指令名
      const payload =
        action.type === 'over' || action.type === 'regex'
          ? typeof action.payload === 'string'
            ? action.payload
            : ''
          : ''
      await runGuarded(command, { text: payload, selection: payload })
      if (!command.options?.silent) {
        view.value = 'manager'
      }
      return
    }
  }

  // 默认进入管理台
  managerTab.value = 'commands'
  view.value = 'manager'
}

/* ---------------------------------------------------------- 搜索框推送 */

function buildPushResults(query) {
  const keyword = String(query || '').trim()
  if (!keyword) return []

  const scored = state.commands
    .filter((command) => command.enabled)
    .map((command) => {
      const byName = fuzzyMatch(keyword, command.name)
      const byDesc = fuzzyMatch(keyword, command.description || '')
      const best = [byName, byDesc].filter(Boolean).sort((a, b) => b.score - a.score)[0]
      return best ? { command, score: best.score } : null
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  return scored.map(({ command }) => {
    recordPush(command.name, command.id, keyword)
    const result = {
      text: command.name,
      title: command.description || `执行「${command.name}」`
    }
    const icon = featureIcon(command)
    if (icon) result.icon = icon
    return result
  })
}

/* ------------------------------------------------------------------ 生命周期 */

onMounted(() => {
  loadAll()
  applyTheme()

  utools.onPluginEnter(handleEnter)
  utools.onPluginOut(() => {
    /* 退出到后台：保留状态即可 */
  })
  utools.onDbPull(() => {
    reloadFromCloud()
  })
  utools.onMainPush(
    (action) => {
      if (!state.settings.mainPushRecommend) return []
      return buildPushResults(action && action.payload)
    },
    () => true
  )

  if (typeof window.matchMedia === 'function') {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', applyTheme)
    }
  }

  syncFeatures()
})
</script>

<template>
  <ManagerView
    v-if="view === 'manager'"
    :initial-tab="managerTab"
    :auto-import="ioAction === 'import'"
    :auto-export="ioAction === 'export'"
    @import-request="ioAction = ''"
  />
  <LauncherView v-else-if="view === 'launcher'" />
  <TextPickerView v-else-if="view === 'text'" :text="textPayload" />

  <ToastHost />
  <ConfirmHost />
  <PromptHost />
</template>
