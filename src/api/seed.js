/**
 * 示例快命令
 *
 * 首次使用时写入，让插件一装上就有可玩的内容；设置页也提供「恢复示例命令」。
 */

import { saveCommand, saveCategory, listCommands } from './db.js'
import { utools } from './env.js'

/** 首次运行标记 */
const SEEDED_KEY = 'qc.seeded'

const DEFAULT_CATEGORIES = ['搜索', '文本', '系统']

const DEFAULT_COMMANDS = [
  {
    name: '百度搜索',
    description: '用百度搜索选中的文字',
    category: '搜索',
    tags: ['搜索', '常用'],
    icon: '🔍',
    action: { type: 'search', engine: 'baidu' },
    options: { useSelection: true, useClipboard: true }
  },
  {
    name: 'GitHub 搜索',
    description: '在 GitHub 代码搜索里查选中的内容',
    category: '搜索',
    tags: ['搜索', '开发'],
    icon: '🐙',
    action: { type: 'search', engine: 'github' },
    options: { useSelection: true, useClipboard: true }
  },
  {
    name: '文本转大写',
    description: '把选中的文字全部转成大写并复制',
    category: '文本',
    tags: ['文本'],
    icon: '🔤',
    action: { type: 'transform', transform: 'upper' },
    options: { useSelection: true, copyResult: true, notify: false }
  },
  {
    name: 'Base64 编码',
    description: '把选中的文字做 Base64 编码并复制',
    category: '文本',
    tags: ['文本', '编码'],
    icon: '🔐',
    action: { type: 'transform', transform: 'base64Encode' },
    options: { useSelection: true, copyResult: true, notify: false }
  },
  {
    name: '提取链接',
    description: '从选中的文字中提取所有网址并复制',
    category: '文本',
    tags: ['文本', '提取'],
    icon: '🔗',
    action: { type: 'transform', transform: 'extractUrls' },
    options: { useSelection: true, copyResult: true, notify: false }
  },
  {
    name: '统计字数',
    description: '统计选中文本的字符数、词数与行数',
    category: '文本',
    tags: ['文本', '统计'],
    icon: '📊',
    action: { type: 'transform', transform: 'countChars' },
    options: { useSelection: true, notify: false }
  },
  {
    name: '打开剪贴板中的网址',
    description: '读取剪贴板，若是一段网址就直接在浏览器打开',
    category: '系统',
    tags: ['系统'],
    icon: '🌐',
    action: { type: 'openUrl', url: '{{clipboard}}' },
    options: { useClipboard: true, notify: true }
  },
  {
    name: '复制当前时间',
    description: '把当前时间戳复制到剪贴板',
    category: '系统',
    tags: ['系统', '时间'],
    icon: '🕐',
    action: {
      type: 'script',
      code: 'return new Date().toLocaleString("zh-CN")',
      timeout: 2000
    },
    options: { copyResult: true, notify: false }
  }
]

/**
 * 写入示例命令（已存在的同名命令会跳过）。
 * @returns {{added: number, skipped: number, errors: string[]}}
 */
export function seedDefaults() {
  let added = 0
  let skipped = 0
  const errors = []

  for (const name of DEFAULT_CATEGORIES) {
    try {
      saveCategory({ name })
    } catch (err) {
      /* 分类已存在时会走到这里，不影响命令写入 */
      console.warn('[seed] 写入分类失败', name, err)
    }
  }

  const now = Date.now()
  DEFAULT_COMMANDS.forEach((command, index) => {
    try {
      saveCommand({
        ...command,
        options: {
          useSelection: true,
          useClipboard: false,
          copyResult: false,
          notify: true,
          silent: false,
          ...(command.options || {})
        },
        enabled: true,
        favorite: index === 0,
        order: 1000 + index,
        runCount: 0,
        lastRunAt: 0,
        createdAt: now,
        updatedAt: now
      })
      added += 1
    } catch (err) {
      skipped += 1
      const message = err && err.message ? err.message : String(err)
      errors.push(`${command.name}：${message}`)
      console.error('[seed] 写入示例命令失败', command.name, err)
    }
  })

  return { added, skipped, errors }
}

function markSeeded() {
  try {
    utools.dbStorage.setItem(SEEDED_KEY, true)
  } catch (err) {
    /* 忽略 */
  }
}

/**
 * 首次运行时写入示例命令。
 *
 * 关键点：只有真的写进去了才标记「已完成」。
 * 之前无论写入成功与否都会置位，导致一旦写失败，
 * 数据库永远是空的却又被认为初始化过了 —— 列表就再也出不来命令。
 * 现在改成以「数据库里有没有命令」为准，可自愈。
 */
export function seedIfFirstRun() {
  const existing = listCommands()
  if (existing.length > 0) {
    markSeeded()
    return { added: 0, skipped: 0, errors: [] }
  }

  const result = seedDefaults()
  if (result.added > 0) {
    markSeeded()
  }
  return result
}
