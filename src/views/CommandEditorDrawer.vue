<script setup>
import { computed, reactive, ref, watch } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import IconPicker from '../components/IconPicker.vue'
import { ACTION_TYPES, ACTION_TYPE_MAP, validateCmdName, defaultActionOf } from '../core/actions.js'
import { UNCATEGORIZED } from '../api/db.js'
import { state, createCommand, updateCommand, categoryNames } from '../stores/quickCommands.js'
import { toastSuccess, toastError } from '../stores/useToast.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  command: { type: Object, default: null }
})

const emit = defineEmits(['close', 'saved'])

const DEFAULT_OPTIONS = {
  useSelection: true,
  useClipboard: false,
  copyResult: false,
  notify: true,
  silent: false
}

const form = reactive({
  id: '',
  name: '',
  description: '',
  category: UNCATEGORIZED,
  tagsText: '',
  icon: '⚡',
  action: defaultActionOf('openUrl'),
  options: { ...DEFAULT_OPTIONS }
})

const saving = ref(false)
const saveAttempted = ref(false)
const nameInput = ref(null)

const isEditing = computed(() => !!form.id)
const meta = computed(() => ACTION_TYPE_MAP[form.action.type])
const fields = computed(() => (meta.value ? meta.value.fields : []))

const nameCheck = computed(() => validateCmdName(form.name))
const duplicateName = computed(
  () =>
    !!form.name &&
    state.commands.some(
      (command) => command.name === form.name.trim() && command.id !== form.id
    )
)

/** 空名称在用户还没输入时不报错，只在保存尝试后提示 */
const showNameError = computed(() => {
  if (nameCheck.value.ok) return false
  if (!form.name.trim()) return saveAttempted.value
  return true
})

const canSave = computed(
  () =>
    nameCheck.value.ok &&
    !duplicateName.value &&
    fields.value.every((field) => !field.required || String(form.action[field.key] ?? '').trim())
)

function reset() {
  const source = props.command
  saveAttempted.value = false
  form.id = source?.id || ''
  form.name = source?.name || ''
  form.description = source?.description || ''
  form.category = source?.category || state.settings.defaultCategory || UNCATEGORIZED
  form.tagsText = (source?.tags || []).join('、')
  form.icon = source?.icon || '⚡'
  form.action = { ...defaultActionOf(source?.action?.type || 'openUrl'), ...(source?.action || {}) }
  form.options = { ...DEFAULT_OPTIONS, ...(source?.options || {}) }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    reset()
  },
  { immediate: true }
)

watch(
  () => props.command?.id,
  () => {
    if (props.open) reset()
  }
)

function onTypeChange(type) {
  const previous = { ...form.action }
  const next = defaultActionOf(type)
  // 同名字段保留用户已填的值（例如 shell → script 时保留 timeout）
  for (const field of ACTION_TYPE_MAP[type].fields) {
    if (previous[field.key] !== undefined) {
      next[field.key] = previous[field.key]
    }
  }
  form.action = next
}

function isFieldVisible(field) {
  return typeof field.showWhen === 'function' ? field.showWhen(form.action) : true
}

function insertVariable(variable, fieldKey) {
  const field = fields.value.find((item) => item.key === fieldKey)
  if (!field) return
  const current = String(form.action[field.key] ?? '')
  form.action[field.key] = `${current}${variable}`
}

async function save() {
  saveAttempted.value = true
  if (!canSave.value) {
    toastError(nameCheck.value.message || '请检查表单填写')
    return
  }
  saving.value = true
  try {
    const payload = {
      id: form.id || undefined,
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category || UNCATEGORIZED,
      tags: form.tagsText
        .split(/[、,，\s]+/)
        .map((tag) => tag.trim())
        .filter(Boolean),
      icon: form.icon,
      action: { ...form.action },
      options: { ...form.options }
    }
    if (isEditing.value) {
      const target = state.commands.find((command) => command.id === form.id)
      await updateCommand({ ...target, ...payload })
      toastSuccess('已保存修改')
    } else {
      await createCommand(payload)
      toastSuccess('已创建快命令')
    }
    emit('saved')
    emit('close')
  } catch (err) {
    toastError(err && err.message ? err.message : '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Transition name="slide">
    <div v-if="open" class="overlay" @click.self="emit('close')">
      <section class="drawer" role="dialog" aria-modal="true">
        <header class="head">
          <h3>{{ isEditing ? '编辑快命令' : '新建快命令' }}</h3>
          <button class="btn-icon" title="关闭" @click="emit('close')">
            <AppIcon name="close" :size="15" />
          </button>
        </header>

        <div class="body scroll">
          <!-- 基本信息 -->
          <div class="field">
            <label class="field-label" for="cmd-name">
              <span>名称 <span class="required">*</span></span>
              <span class="text-faint">{{ form.name.length }}/80</span>
            </label>
            <input
              id="cmd-name"
              ref="nameInput"
              v-model="form.name"
              class="input"
              placeholder="例如：百度搜索"
              maxlength="80"
            />
            <p v-if="showNameError" class="field-error">{{ nameCheck.message }}</p>
            <p v-else-if="duplicateName" class="field-error">已存在同名命令，uTools 搜索框中会同时出现两条</p>
            <p v-else class="field-tip">名称会作为 uTools 功能指令，可直接在搜索框输入触发</p>
          </div>

          <div class="field">
            <label class="field-label" for="cmd-desc">描述</label>
            <input id="cmd-desc" v-model="form.description" class="input" placeholder="选填，用于说明这条命令的用途" />
          </div>

          <div class="grid-2">
            <div class="field">
              <label class="field-label" for="cmd-category">分类</label>
              <input id="cmd-category" v-model="form.category" class="input" list="qc-category-options" />
              <datalist id="qc-category-options">
                <option v-for="name in categoryNames" :key="name" :value="name" />
              </datalist>
            </div>
            <div class="field">
              <label class="field-label" for="cmd-tags">标签</label>
              <input id="cmd-tags" v-model="form.tagsText" class="input" placeholder="用「、」分隔，例如：搜索、常用" />
            </div>
          </div>

          <div class="field">
            <label class="field-label">图标</label>
            <IconPicker v-model="form.icon" />
          </div>

          <div class="divider"></div>

          <!-- 动作 -->
          <p class="section-title">动作</p>
          <div class="type-grid">
            <button
              v-for="type in ACTION_TYPES"
              :key="type.id"
              type="button"
              class="type-item"
              :class="{ active: form.action.type === type.id }"
              @click="onTypeChange(type.id)"
            >
              <span class="type-emoji">{{ type.icon }}</span>
              <span class="type-name">{{ type.name }}</span>
            </button>
          </div>

          <p v-if="meta?.danger" class="danger-tip">
            <AppIcon name="info" :size="13" />
            该动作会在本机执行内容，请只填写你自己信任的命令或脚本。
          </p>

          <div v-for="field in fields" :key="field.key" v-show="isFieldVisible(field)" class="field">
            <label class="field-label" :for="`field-${field.key}`">
              <span>{{ field.label }} <span v-if="field.required" class="required">*</span></span>
              <span v-if="field.type === 'textarea'" class="row">
                <button
                  v-for="variable in ['{{text}}', '{{selection}}', '{{clipboard}}']"
                  :key="variable"
                  type="button"
                  class="btn btn-sm btn-ghost"
                  @click="insertVariable(variable, field.key)"
                >
                  {{ variable }}
                </button>
              </span>
            </label>

            <textarea
              v-if="field.type === 'textarea'"
              :id="`field-${field.key}`"
              v-model="form.action[field.key]"
              class="textarea"
              :rows="field.key === 'code' || field.key === 'command' ? 4 : 3"
              :placeholder="field.placeholder"
            ></textarea>

            <input
              v-else-if="field.type === 'number'"
              :id="`field-${field.key}`"
              v-model.number="form.action[field.key]"
              class="input"
              type="number"
              :min="field.min"
              :max="field.max"
            />

            <label v-else-if="field.type === 'toggle'" class="checkbox">
              <input v-model="form.action[field.key]" type="checkbox" />
              <span>{{ field.label }}</span>
            </label>

            <select
              v-else-if="field.type === 'select'"
              :id="`field-${field.key}`"
              v-model="form.action[field.key]"
              class="select"
            >
              <template v-if="field.groups">
                <optgroup v-for="group in field.groups" :key="group.label" :label="group.label">
                  <option v-for="option in group.options" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </optgroup>
              </template>
              <template v-else>
                <option v-for="option in field.options" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </template>
            </select>

            <input
              v-else
              :id="`field-${field.key}`"
              v-model="form.action[field.key]"
              class="input"
              :placeholder="field.placeholder"
            />

            <p v-if="field.tip" class="field-tip">{{ field.tip }}</p>
          </div>

          <div class="divider"></div>

          <!-- 执行选项 -->
          <p class="section-title">执行选项</p>
          <label class="checkbox option">
            <input v-model="form.options.useSelection" type="checkbox" />
            <span>优先使用超级面板中选中的文本</span>
          </label>
          <label class="checkbox option">
            <input v-model="form.options.useClipboard" type="checkbox" />
            <span>没有选中文本时读取剪贴板</span>
          </label>
          <label class="checkbox option">
            <input v-model="form.options.copyResult" type="checkbox" />
            <span>执行后把结果复制到剪贴板</span>
          </label>
          <label class="checkbox option">
            <input v-model="form.options.notify" type="checkbox" />
            <span>执行后弹出系统通知</span>
          </label>
          <label class="checkbox option">
            <input v-model="form.options.silent" type="checkbox" />
            <span>执行时不显示插件窗口（静默模式）</span>
          </label>
        </div>

        <footer class="foot">
          <button class="btn" @click="emit('close')">取消</button>
          <button class="btn btn-primary" :disabled="!canSave || saving" @click="save">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </footer>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.overlay {
  position: absolute;
  inset: 0;
  z-index: 60;
  display: flex;
  justify-content: flex-end;
  background: rgba(15, 23, 42, 0.32);
}

.drawer {
  width: 460px;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border);
  background: var(--bg-elevated);
  box-shadow: var(--shadow);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}

.head h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.body {
  flex: 1;
  padding: 14px;
  overflow-y: auto;
}

.foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 11px 14px;
  border-top: 1px solid var(--border);
  background: var(--bg-elevated);
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 12px;
}

.type-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-bottom: 14px;
}

.type-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 9px 4px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  font-size: 11.5px;
  color: var(--text-muted);
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}

.type-item:hover {
  border-color: var(--border-strong);
}

.type-item.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}

.type-emoji {
  font-size: 18px;
  line-height: 1.1;
}

.danger-tip {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0 0 14px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--warning-soft);
  color: var(--warning);
  font-size: 12px;
  line-height: 1.5;
}

.option {
  display: flex;
  margin-bottom: 8px;
}

.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.18s;
}

.slide-enter-active .drawer,
.slide-leave-active .drawer {
  transition: transform 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
}

.slide-enter-from .drawer,
.slide-leave-to .drawer {
  transform: translateX(100%);
}
</style>
