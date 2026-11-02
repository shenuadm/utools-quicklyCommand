/**
 * 快命令与分类的数据访问层
 *
 * 走 uTools.db 同步数据库：用户数据可跨设备同步。
 * 文档 ID 形如 qc/command/<uuid>、qc/category/<uuid>，便于前缀批量查询。
 */

import { utools } from './env.js'
import { defaultActionOf } from '../core/actions.js'

export const COMMAND_PREFIX = 'qc/command/'
export const CATEGORY_PREFIX = 'qc/category/'

/** 未归类的命令使用的分类名 */
export const UNCATEGORIZED = '未分类'

/** 生成一个 uuid（crypto.randomUUID 在非安全上下文不可用，故保留兜底） */
export function uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function toText(value) {
  return value === undefined || value === null ? '' : String(value)
}

function toArray(value) {
  return Array.isArray(value) ? value.filter((item) => item !== undefined && item !== null) : []
}

/* --------------------------------------------------------------- 归一化 */

const DEFAULT_OPTIONS = {
  useSelection: true,
  useClipboard: false,
  copyResult: false,
  notify: true,
  silent: false
}

/** 把数据库文档整理成前端使用的命令对象 */
export function normalizeCommand(doc) {
  if (!doc || !doc._id) return null
  const id = doc._id.startsWith(COMMAND_PREFIX)
    ? doc._id.slice(COMMAND_PREFIX.length)
    : doc._id
  const action = doc.action && typeof doc.action === 'object' ? doc.action : { type: 'openUrl' }
  return {
    id,
    _id: doc._id,
    _rev: doc._rev,
    name: toText(doc.name),
    description: toText(doc.description),
    category: toText(doc.category) || UNCATEGORIZED,
    tags: toArray(doc.tags).map((tag) => toText(tag)).filter(Boolean),
    icon: toText(doc.icon),
    action: { ...defaultActionOf(action.type), ...action },
    options: { ...DEFAULT_OPTIONS, ...(doc.options || {}) },
    favorite: !!doc.favorite,
    enabled: doc.enabled !== false,
    order: typeof doc.order === 'number' ? doc.order : 1000,
    runCount: typeof doc.runCount === 'number' ? doc.runCount : 0,
    lastRunAt: typeof doc.lastRunAt === 'number' ? doc.lastRunAt : 0,
    createdAt: typeof doc.createdAt === 'number' ? doc.createdAt : Date.now(),
    updatedAt: typeof doc.updatedAt === 'number' ? doc.updatedAt : Date.now()
  }
}

/** 把数据库文档整理成前端使用的分类对象 */
export function normalizeCategory(doc) {
  if (!doc || !doc._id) return null
  return {
    id: doc._id.startsWith(CATEGORY_PREFIX) ? doc._id.slice(CATEGORY_PREFIX.length) : doc._id,
    _id: doc._id,
    _rev: doc._rev,
    name: toText(doc.name),
    order: typeof doc.order === 'number' ? doc.order : 1000,
    createdAt: typeof doc.createdAt === 'number' ? doc.createdAt : Date.now()
  }
}

/* ----------------------------------------------------------------- 查询 */

function allDocs(prefix) {
  try {
    const docs = utools.db.allDocs(prefix)
    return Array.isArray(docs) ? docs : []
  } catch (err) {
    console.error('[db] 读取失败', prefix, err)
    return []
  }
}

/** 全部快命令（按 order、更新时间排序） */
export function listCommands() {
  return allDocs(COMMAND_PREFIX)
    .map(normalizeCommand)
    .filter(Boolean)
    .sort((a, b) => a.order - b.order || b.updatedAt - a.updatedAt)
}

/** 单条快命令 */
export function getCommand(id) {
  try {
    const doc = utools.db.get(id.startsWith(COMMAND_PREFIX) ? id : COMMAND_PREFIX + id)
    return normalizeCommand(doc)
  } catch (err) {
    console.error('[db] 读取快命令失败', id, err)
    return null
  }
}

/** 全部分类 */
export function listCategories() {
  return allDocs(CATEGORY_PREFIX)
    .map(normalizeCategory)
    .filter(Boolean)
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
}

/* ----------------------------------------------------------------- 写入 */

/**
 * 保存（新增或更新）一条快命令。
 * @returns {object} 保存后的命令对象
 */
export function saveCommand(command) {
  const id = command.id || uuid()
  const _id = COMMAND_PREFIX + id
  const doc = {
    ...command,
    id: undefined,
    _id,
    name: toText(command.name).trim(),
    description: toText(command.description),
    category: toText(command.category) || UNCATEGORIZED,
    tags: toArray(command.tags).map((tag) => toText(tag).trim()).filter(Boolean),
    icon: toText(command.icon),
    action: { ...defaultActionOf(command.action?.type), ...(command.action || {}) },
    options: { ...DEFAULT_OPTIONS, ...(command.options || {}) },
    favorite: !!command.favorite,
    enabled: command.enabled !== false,
    order: typeof command.order === 'number' ? command.order : 1000,
    runCount: typeof command.runCount === 'number' ? command.runCount : 0,
    lastRunAt: typeof command.lastRunAt === 'number' ? command.lastRunAt : 0,
    createdAt: command.createdAt || Date.now(),
    updatedAt: Date.now()
  }
  delete doc.id

  // 更新已有文档必须携带最新版本号。优先用调用方带来的 _rev；
  // 拿不到时再向数据库要一次，但这一步失败不能阻断保存。
  if (!doc._rev) {
    // 新建文档时不要带 _rev 这个键（哪怕值是 undefined），
    // 部分文档存储会拒绝「带 _rev 的插入」。
    delete doc._rev
    try {
      const existing = utools.db.get(_id)
      if (existing && existing._rev) {
        doc._rev = existing._rev
      }
    } catch (err) {
      console.warn('[db] 读取现有文档失败，将按新建处理', _id, err)
    }
  }

  const result = utools.db.put(doc)
  if (!result || !result.ok) {
    throw new Error((result && result.message) || '保存失败')
  }
  doc._rev = result.rev
  return normalizeCommand(doc)
}

/**
 * 删除一条快命令。
 */
export function deleteCommand(command) {
  const id = typeof command === 'string' ? command : command._id
  try {
    const doc = utools.db.get(id)
    if (!doc) return { ok: false, message: '快命令不存在' }
    const result = utools.db.remove(doc)
    return { ok: !!(result && result.ok), message: result && result.ok ? '' : '删除失败' }
  } catch (err) {
    return { ok: false, message: err.message }
  }
}

/**
 * 保存一个分类。
 */
export function saveCategory(category) {
  const id = category.id || uuid()
  const _id = CATEGORY_PREFIX + id
  const doc = {
    ...category,
    id: undefined,
    _id,
    name: toText(category.name).trim(),
    order: typeof category.order === 'number' ? category.order : 1000,
    createdAt: category.createdAt || Date.now()
  }
  delete doc.id

  if (!doc._rev) {
    delete doc._rev
    try {
      const existing = utools.db.get(_id)
      if (existing && existing._rev) {
        doc._rev = existing._rev
      }
    } catch (err) {
      console.warn('[db] 读取现有分类失败，将按新建处理', _id, err)
    }
  }

  const result = utools.db.put(doc)
  if (!result || !result.ok) {
    throw new Error((result && result.message) || '保存失败')
  }
  doc._rev = result.rev
  return normalizeCategory(doc)
}

/**
 * 删除一个分类，并把其下命令回落到「未分类」。
 * @returns {{ok: boolean, message: string, moved: number}}
 */
export function deleteCategory(category) {
  const name = typeof category === 'string' ? category : category.name
  const id = typeof category === 'string' ? null : category._id
  try {
    if (id) {
      const doc = utools.db.get(id)
      if (doc) utools.db.remove(doc)
    }

    let moved = 0
    for (const command of listCommands()) {
      if (command.category === name) {
        saveCommand({ ...command, category: UNCATEGORIZED })
        moved += 1
      }
    }
    return { ok: true, message: '', moved }
  } catch (err) {
    return { ok: false, message: err.message, moved: 0 }
  }
}

/**
 * 重命名分类，并同步改写其下命令的 category 字段。
 */
export function renameCategory(category, newName) {
  const name = toText(newName).trim()
  if (!name) return { ok: false, message: '分类名不能为空' }
  try {
    const updated = saveCategory({ ...category, name })
    for (const command of listCommands()) {
      if (command.category === category.name) {
        saveCommand({ ...command, category: name })
      }
    }
    return { ok: true, message: '', category: updated }
  } catch (err) {
    return { ok: false, message: err.message }
  }
}

/**
 * 记录一次执行（累加次数并更新时间）。
 */
export function recordRun(command) {
  try {
    const latest = getCommand(command.id) || command
    return saveCommand({
      ...latest,
      runCount: (latest.runCount || 0) + 1,
      lastRunAt: Date.now()
    })
  } catch (err) {
    console.error('[db] 记录执行失败', err)
    return command
  }
}

/** 清空全部快命令与分类 */
export function clearAll() {
  for (const command of listCommands()) {
    deleteCommand(command)
  }
  for (const category of listCategories()) {
    try {
      const doc = utools.db.get(category._id)
      if (doc) utools.db.remove(doc)
    } catch (err) {
      /* 忽略单个删除失败 */
    }
  }
}
