<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import {
  state,
  updateSettings,
  resetRunLog,
  removeAllFeatures,
  loadAll,
  syncFeatures
} from '../stores/quickCommands.js'
import { exportToFile, pickImportFile, mergeImport, MERGE_STRATEGIES } from '../api/io.js'
import { seedDefaults } from '../api/seed.js'
import { services, utools, isUtools } from '../api/env.js'
import { confirmDialog } from '../stores/useConfirm.js'
import { toastSuccess, toastError } from '../stores/useToast.js'

const props = defineProps({
  /** 进入页面时自动执行的动作：import | export */
  autoAction: { type: String, default: '' }
})

const emit = defineEmits(['action-done'])

const mergeStrategy = ref('overwrite')
const busy = ref(false)

/** 只在自动动作变化时触发一次 */
let autoTriggered = ''
watch(
  () => props.autoAction,
  async (action) => {
    if (!action || action === autoTriggered) return
    autoTriggered = action
    await nextTick()
    if (action === 'import') await doImport()
    else if (action === 'export') await doExport()
    emit('action-done')
  },
  { immediate: true }
)

const theme = computed({
  get: () => state.settings.theme,
  set: (value) => updateSettings({ theme: value })
})

const localDataPath = computed(() => {
  try {
    return services.getLocalDataPath() || '（当前环境不可用）'
  } catch (err) {
    return '（当前环境不可用）'
  }
})

const appVersion = computed(() => {
  try {
    return utools.getAppVersion()
  } catch (err) {
    return '未知'
  }
})

const featureCount = computed(() => state.commands.filter((command) => command.enabled).length)

async function doExport() {
  busy.value = true
  try {
    const result = await exportToFile(state.commands, state.categories)
    if (result.ok) {
      toastSuccess(result.message)
    } else if (result.message !== '已取消导出') {
      toastError(result.message)
    }
  } finally {
    busy.value = false
  }
}

async function doImport() {
  const picked = await pickImportFile()
  if (!picked.ok) {
    if (picked.message !== '已取消导入') toastError(picked.message)
    return
  }
  const count = picked.data.commands.length
  const confirmed = await confirmDialog({
    title: '导入快命令配置',
    message: `即将导入 ${count} 条快命令。遇到同名命令时按下面的策略处理。`,
    detail: `策略：${MERGE_STRATEGIES.find((item) => item.value === mergeStrategy.value)?.label}`,
    confirmText: '开始导入'
  })
  if (!confirmed) return

  busy.value = true
  try {
    const result = mergeImport(picked.data, mergeStrategy.value)
    if (result.ok) {
      loadAll()
      syncFeatures()
      toastSuccess(result.message)
    } else {
      toastError(result.message)
    }
  } finally {
    busy.value = false
  }
}

async function restoreDefaults() {
  const confirmed = await confirmDialog({
    title: '恢复示例命令？',
    message: '会重新写入一组示例快命令与「搜索 / 文本 / 系统」分类，不会删除你已有的命令。',
    confirmText: '恢复'
  })
  if (!confirmed) return
  const result = seedDefaults()
  loadAll()
  syncFeatures()
  toastSuccess(`已写入 ${result.added} 条示例命令`)
}

async function cleanupFeatures() {
  const confirmed = await confirmDialog({
    title: '清理全部动态功能？',
    message: `会把 ${featureCount.value} 条快命令从 uTools 搜索框中移除（数据不会丢失，可随时重新同步）。`,
    confirmText: '清理'
  })
  if (!confirmed) return
  const count = removeAllFeatures()
  toastSuccess(`已清理 ${count} 个动态功能`)
}

async function clearLog() {
  const confirmed = await confirmDialog({
    title: '清空运行记录？',
    message: '只会清空统计面板里的执行记录，不影响累计执行次数。',
    confirmText: '清空'
  })
  if (!confirmed) return
  resetRunLog()
}

function onThemeChange(value) {
  theme.value = value
}
</script>

<template>
  <div class="settings-view scroll">
    <section class="card">
      <h4>外观</h4>
      <div class="row">
        <span class="label grow">主题</span>
        <div class="segmented">
          <button
            v-for="option in [
              { value: 'auto', label: '跟随系统' },
              { value: 'light', label: '浅色' },
              { value: 'dark', label: '深色' }
            ]"
            :key="option.value"
            class="seg-item"
            :class="{ active: theme === option.value }"
            @click="onThemeChange(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </section>

    <section class="card">
      <h4>uTools 集成</h4>

      <label class="setting">
        <span class="grow">
          <span class="label">注册为动态功能</span>
          <span class="desc">
            把启用的快命令写入 uTools 搜索框与超级面板，可直接输入命令名触发
          </span>
        </span>
        <span class="switch">
          <input
            type="checkbox"
            :checked="state.settings.registerFeatures"
            @change="updateSettings({ registerFeatures: $event.target.checked })"
          />
          <span class="knob"></span>
        </span>
      </label>

      <label class="setting">
        <span class="grow">
          <span class="label">搜索框实时推荐</span>
          <span class="desc">在 uTools 搜索框输入时实时推送匹配的快命令</span>
        </span>
        <span class="switch">
          <input
            type="checkbox"
            :checked="state.settings.mainPushRecommend"
            @change="updateSettings({ mainPushRecommend: $event.target.checked })"
          />
          <span class="knob"></span>
        </span>
      </label>

      <div class="setting">
        <span class="grow">
          <span class="label">清理动态功能</span>
          <span class="desc">当前 {{ featureCount }} 条快命令已注册</span>
        </span>
        <button class="btn btn-sm" @click="cleanupFeatures">全部清理</button>
      </div>
    </section>

    <section class="card">
      <h4>执行</h4>

      <label class="setting">
        <span class="grow">
          <span class="label">执行本地命令前确认</span>
          <span class="desc">运行「执行本地命令 / 执行 JS 脚本」前弹确认框</span>
        </span>
        <span class="switch">
          <input
            type="checkbox"
            :checked="state.settings.confirmBeforeRun"
            @change="updateSettings({ confirmBeforeRun: $event.target.checked })"
          />
          <span class="knob"></span>
        </span>
      </label>

      <label class="setting">
        <span class="grow">
          <span class="label">显示已禁用的命令</span>
          <span class="desc">在列表中展示被关闭的快命令</span>
        </span>
        <span class="switch">
          <input
            type="checkbox"
            :checked="state.settings.showDisabled"
            @change="updateSettings({ showDisabled: $event.target.checked })"
          />
          <span class="knob"></span>
        </span>
      </label>
    </section>

    <section class="card">
      <h4>数据</h4>

      <div class="field">
        <label class="field-label" for="default-category">新建命令的默认分类</label>
        <input
          id="default-category"
          class="input"
          :value="state.settings.defaultCategory"
          placeholder="留空则使用「未分类」"
          @change="updateSettings({ defaultCategory: $event.target.value.trim() })"
        />
      </div>

      <div class="row wrap">
        <button class="btn" :disabled="busy" @click="doExport">
          <AppIcon name="export" :size="14" />导出为 JSON
        </button>
        <button class="btn" :disabled="busy" @click="doImport">
          <AppIcon name="import" :size="14" />从 JSON 导入
        </button>
        <button class="btn" @click="restoreDefaults">
          <AppIcon name="refresh" :size="14" />恢复示例命令
        </button>
        <button class="btn" @click="clearLog">
          <AppIcon name="trash" :size="14" />清空运行记录
        </button>
      </div>

      <div class="field import-strategy">
        <label class="field-label" for="merge-strategy">导入时遇到同名命令</label>
        <select id="merge-strategy" v-model="mergeStrategy" class="select">
          <option v-for="option in MERGE_STRATEGIES" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
    </section>

    <section class="card">
      <h4>关于</h4>
      <dl class="about">
        <dt>插件名称</dt>
        <dd>快命令管理 QuicklyCommand</dd>
        <dt>版本</dt>
        <dd>{{ appVersion }}</dd>
        <dt>运行环境</dt>
        <dd>{{ isUtools ? 'uTools Runtime' : '浏览器（本地预览）' }}</dd>
        <dt>数据存储</dt>
        <dd>
          命令与分类保存在 uTools 同步数据库，可在多设备间同步；偏好设置保存在
          dbStorage。
        </dd>
        <dt>本地数据目录</dt>
        <dd class="mono path">{{ localDataPath }}</dd>
      </dl>
      <p class="note">
        <AppIcon name="info" :size="13" />
        「执行本地命令」与「执行 JS 脚本」会运行你自己编写的内容。请只填写自己信任的代码，
        并保持「执行本地命令前确认」开启。
      </p>
    </section>
  </div>
</template>

<style scoped>
.settings-view {
  height: 100%;
  padding: 14px;
}

.card {
  margin-bottom: 12px;
  padding: 13px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
}

.card h4 {
  margin: 0 0 10px;
  font-size: 13.5px;
  font-weight: 600;
}

.setting {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 0;
  border-top: 1px solid var(--border);
}

.setting:first-of-type {
  border-top: none;
}

.label {
  display: block;
  font-size: 13px;
  color: var(--text);
}

.desc {
  display: block;
  margin-top: 2px;
  font-size: 11.5px;
  color: var(--text-faint);
  line-height: 1.5;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.row.wrap {
  flex-wrap: wrap;
}

.segmented {
  display: inline-flex;
  padding: 2px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-sunken);
}

.seg-item {
  height: 24px;
  padding: 0 11px;
  border-radius: 5px;
  font-size: 12px;
  color: var(--text-muted);
}

.seg-item.active {
  background: var(--bg-elevated);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}

.import-strategy {
  margin-top: 12px;
  max-width: 260px;
}

.about {
  display: grid;
  grid-template-columns: 92px 1fr;
  gap: 6px 12px;
  margin: 0;
  font-size: 12.5px;
}

.about dt {
  color: var(--text-faint);
}

.about dd {
  margin: 0;
  color: var(--text);
  line-height: 1.6;
}

.about dd.path {
  font-size: 11px;
  word-break: break-all;
  color: var(--text-muted);
}

.note {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 12px 0 0;
  padding: 9px 10px;
  border-radius: var(--radius-sm);
  background: var(--warning-soft);
  color: var(--warning);
  font-size: 12px;
  line-height: 1.6;
}
</style>
