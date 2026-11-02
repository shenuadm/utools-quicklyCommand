/**
 * 动作类型定义与模板渲染
 *
 * 「动作」决定一条快命令被触发后到底做什么。这里集中描述 8 种动作的元数据，
 * 编辑器据此动态渲染表单，执行器据此分发逻辑。
 */

import { ENGINES, CUSTOM_ENGINE, engineTemplate } from './engines.js'
import { TRANSFORM_GROUPS } from './transforms.js'

/** uTools 功能指令名称的非法字符 */
const FORBIDDEN_CMD_CHARS = /[\\/:*?"<>|]/
/** 控制字符 */
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/
/** 纯 emoji / 纯空白 */
const ONLY_EMOJI_OR_BLANK = /^[\p{Extended_Pictographic}\p{Emoji_Component}\s️]*$/u

export const MAX_CMD_NAME_LENGTH = 80

function toText(value) {
  return value === undefined || value === null ? '' : String(value)
}

/* ------------------------------------------------------------------ 模板 */

/** 支持的过滤器 */
const FILTERS = {
  raw: (value) => value,
  urlencode: (value) => encodeURIComponent(value),
  trim: (value) => value.trim(),
  base64: (value) => {
    const bytes = new TextEncoder().encode(value)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
    }
    return btoa(binary)
  },
  upper: (value) => value.toUpperCase(),
  lower: (value) => value.toLowerCase()
}

// 变量名与过滤器名允许数字（例如 base64）
const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*(?:\|\s*([a-zA-Z0-9_]+)\s*)?\}\}/g

/**
 * 渲染模板。
 *
 * 支持的变量：text / selection / clipboard
 * 支持的过滤器：raw（不编码）、urlencode、trim、base64、upper、lower
 *
 * @param {string} template 模板文本
 * @param {Record<string, string>} vars 变量表
 * @param {{urlEncode?: boolean}} [options] urlEncode 为 true 时，未指定过滤器的 {{text}} 会被 URL 编码
 */
export function renderTemplate(template, vars = {}, options = {}) {
  const { urlEncode = false } = options
  return toText(template).replace(TOKEN_PATTERN, (_match, name, filter) => {
    const value = toText(vars[name])
    if (filter && FILTERS[filter]) {
      return FILTERS[filter](value)
    }
    return urlEncode ? encodeURIComponent(value) : value
  })
}

/** 模板中是否引用了指定变量 */
export function templateUsesVariable(template, varName) {
  TOKEN_PATTERN.lastIndex = 0
  let match
  while ((match = TOKEN_PATTERN.exec(toText(template))) !== null) {
    if (match[1] === varName) {
      TOKEN_PATTERN.lastIndex = 0
      return true
    }
  }
  TOKEN_PATTERN.lastIndex = 0
  return false
}

/** 模板中是否引用了文本类变量 */
export function templateUsesText(template) {
  return ['text', 'selection', 'clipboard'].some((name) =>
    templateUsesVariable(template, name)
  )
}

/* ------------------------------------------------------------ 指令名校验 */

/**
 * 校验快命令名称能否作为 uTools 功能指令使用。
 * @returns {{ok: boolean, message: string}}
 */
export function validateCmdName(name) {
  const value = toText(name)
  if (!value.trim()) {
    return { ok: false, message: '名称不能为空' }
  }
  if (value.length > MAX_CMD_NAME_LENGTH) {
    return { ok: false, message: `名称不能超过 ${MAX_CMD_NAME_LENGTH} 个字符` }
  }
  if (CONTROL_CHARS.test(value)) {
    return { ok: false, message: '名称不能包含控制字符' }
  }
  if (FORBIDDEN_CMD_CHARS.test(value)) {
    return { ok: false, message: '名称不能包含 \\ / : * ? " < > | 等系统保留字符' }
  }
  if (ONLY_EMOJI_OR_BLANK.test(value)) {
    return { ok: false, message: '名称不能只由 Emoji 或空白组成' }
  }
  return { ok: true, message: '' }
}

/* -------------------------------------------------------------- 动作定义 */

const transformOptions = TRANSFORM_GROUPS.map((group) => ({
  label: group.name,
  options: group.items.map((item) => ({ value: item.id, label: item.name }))
}))

/**
 * 8 种动作类型。
 *
 * fields 描述编辑器的动态表单：
 *   type: text | textarea | number | toggle | select | transform | engine
 */
export const ACTION_TYPES = [
  {
    id: 'openUrl',
    name: '打开网址',
    icon: '🌐',
    description: '在默认浏览器中打开网址，{{text}} 会被替换为输入文本',
    fields: [
      {
        key: 'url',
        label: '网址',
        type: 'textarea',
        placeholder: 'https://example.com/search?q={{text}}',
        required: true,
        tip: '支持 {{text}}、{{selection}}、{{clipboard}} 变量'
      }
    ],
    defaultAction: { type: 'openUrl', url: 'https://www.google.com/search?q={{text}}' }
  },
  {
    id: 'search',
    name: '搜索引擎',
    icon: '🔍',
    description: '用内置或自定义搜索引擎搜索输入文本',
    fields: [
      {
        key: 'engine',
        label: '搜索引擎',
        type: 'select',
        defaultValue: 'google',
        options: [
          ...ENGINES.map((engine) => ({ value: engine.id, label: engine.name })),
          { value: CUSTOM_ENGINE, label: '自定义…' }
        ]
      },
      {
        key: 'urlTemplate',
        label: '自定义搜索 URL',
        type: 'text',
        placeholder: 'https://example.com?q={{text}}',
        showWhen: (action) => action.engine === CUSTOM_ENGINE,
        tip: '使用 {{text}} 占位符表示搜索词'
      }
    ],
    defaultAction: { type: 'search', engine: 'google', urlTemplate: '' },
    needsText: true
  },
  {
    id: 'transform',
    name: '文本处理',
    icon: '🔤',
    description: '对输入文本做大小写、编码、提取等转换',
    fields: [
      {
        key: 'transform',
        label: '转换方式',
        type: 'select',
        groups: transformOptions,
        defaultValue: 'upper'
      }
    ],
    defaultAction: { type: 'transform', transform: 'upper' },
    needsText: true
  },
  {
    id: 'shell',
    name: '执行本地命令',
    icon: '⚙️',
    description: '在本机执行一条 Shell 命令',
    danger: true,
    fields: [
      {
        key: 'command',
        label: '命令',
        type: 'textarea',
        placeholder: 'echo {{text}}',
        required: true,
        tip: '支持 {{text}} 变量；命令在系统 Shell 中执行'
      },
      {
        key: 'cwd',
        label: '工作目录',
        type: 'text',
        placeholder: '留空则使用当前目录'
      },
      {
        key: 'timeout',
        label: '超时（毫秒）',
        type: 'number',
        defaultValue: 30000,
        min: 1000,
        max: 300000
      }
    ],
    defaultAction: { type: 'shell', command: 'echo {{text}}', cwd: '', timeout: 30000 }
  },
  {
    id: 'script',
    name: '执行 JS 脚本',
    icon: '📜',
    description: '在沙箱中执行一段 JavaScript',
    danger: true,
    fields: [
      {
        key: 'code',
        label: '脚本',
        type: 'textarea',
        placeholder: 'return text.toUpperCase()',
        required: true,
        tip: '可用变量：text / selection / clipboard；脚本的返回值即结果'
      },
      {
        key: 'timeout',
        label: '超时（毫秒）',
        type: 'number',
        defaultValue: 5000,
        min: 100,
        max: 30000
      }
    ],
    defaultAction: { type: 'script', code: 'return text.toUpperCase()', timeout: 5000 }
  },
  {
    id: 'openPath',
    name: '打开文件或目录',
    icon: '📂',
    description: '用系统默认程序打开一个文件或目录',
    fields: [
      {
        key: 'path',
        label: '路径',
        type: 'text',
        placeholder: 'C:\\Users\\me\\notes.md',
        required: true,
        tip: '支持 {{text}} 变量'
      },
      {
        key: 'reveal',
        label: '在文件管理器中定位',
        type: 'toggle',
        defaultValue: false
      }
    ],
    defaultAction: { type: 'openPath', path: '', reveal: false }
  },
  {
    id: 'copy',
    name: '复制到剪贴板',
    icon: '📋',
    description: '把指定内容复制到系统剪贴板',
    fields: [
      {
        key: 'text',
        label: '内容',
        type: 'textarea',
        placeholder: '{{text}}',
        required: true,
        tip: '留空则复制输入文本本身'
      }
    ],
    defaultAction: { type: 'copy', text: '{{text}}' }
  },
  {
    id: 'redirect',
    name: '跳转到其他插件',
    icon: '🔗',
    description: '调用 uTools.redirect 跳转到另一个插件的功能指令',
    fields: [
      {
        key: 'target',
        label: '目标指令名',
        type: 'text',
        placeholder: '翻译',
        required: true
      },
      {
        key: 'plugin',
        label: '目标插件名',
        type: 'text',
        placeholder: '留空则在所有插件中查找',
        tip: '填写后与指令名一起构成 [插件名, 指令名]'
      },
      {
        key: 'payload',
        label: '传递内容',
        type: 'text',
        placeholder: '{{text}}',
        tip: '匹配指令必须携带内容，功能指令可留空'
      }
    ],
    defaultAction: { type: 'redirect', target: '', plugin: '', payload: '' }
  }
]

/** id → 动作类型 */
export const ACTION_TYPE_MAP = ACTION_TYPES.reduce((acc, item) => {
  acc[item.id] = item
  return acc
}, {})

/** 动作类型 id → 名称 */
export function actionTypeName(type) {
  const found = ACTION_TYPE_MAP[type]
  return found ? found.name : type
}

/** 动作类型 id → 图标 */
export function actionTypeIcon(type) {
  const found = ACTION_TYPE_MAP[type]
  return found ? found.icon : '⚡'
}

/** 取某个动作类型的默认配置 */
export function defaultActionOf(type) {
  const found = ACTION_TYPE_MAP[type]
  return found ? { ...found.defaultAction } : { type: 'openUrl', url: '' }
}

/**
 * 判断一个具体配置是否真的需要输入文本。
 * 用于决定要不要给这条快命令挂上「文本匹配指令」。
 */
export function actionUsesText(action) {
  return ['text', 'selection', 'clipboard'].some((name) => actionUsesVariable(action, name))
}

/**
 * 判断某个动作配置是否引用了指定变量。
 */
export function actionUsesVariable(action, varName) {
  if (!action || typeof action !== 'object') return false
  const meta = ACTION_TYPE_MAP[action.type]
  if (!meta) return false

  if (action.type === 'search') {
    return templateUsesVariable(engineTemplate(action.engine, action.urlTemplate), varName)
  }
  if (action.type === 'transform') {
    return varName === 'text'
  }
  return meta.fields.some((field) => templateUsesVariable(action[field.key], varName))
}

/** 动作配置里所有涉及文本的字段值，用于生成「插入变量」按钮 */
export function actionTextFields(action) {
  if (!action || !ACTION_TYPE_MAP[action.type]) return []
  return ACTION_TYPE_MAP[action.type].fields
    .filter((field) => field.type === 'textarea' || field.type === 'text')
    .map((field) => ({ key: field.key, label: field.label }))
}

/**
 * 取一条动作的「执行内容」——也就是这条命令真正要做的那件事的原文。
 *
 * 返回的是配置里的原始文本，模板变量（如 {{text}}）保持原样，
 * 这样复制出去可以直接贴到终端、配置文件或聊天里。
 *
 * @param {object} action 动作配置
 * @returns {string} 执行内容，没有则返回空串
 */
export function actionBody(action) {
  if (!action || typeof action !== 'object') return ''

  switch (action.type) {
    case 'openUrl':
      return toText(action.url)
    case 'search':
      return engineTemplate(action.engine, action.urlTemplate)
    case 'transform':
      return toText(action.transform)
    case 'shell':
      return toText(action.command)
    case 'script':
      return toText(action.code)
    case 'openPath':
      return toText(action.path)
    case 'copy':
      return toText(action.text)
    case 'redirect':
      return toText(action.target)
    default:
      return ''
  }
}

/** 取一条快命令的执行内容 */
export function commandBody(command) {
  if (!command) return ''
  return actionBody(command.action)
}
