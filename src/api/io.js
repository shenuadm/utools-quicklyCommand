/**
 * 导入 / 导出
 *
 * 导出格式为一段 JSON，便于备份与在设备之间迁移。
 */

import { services } from './env.js'
import { saveCommand, saveCategory, listCommands, listCategories, uuid } from './db.js'

export const EXPORT_VERSION = 1

/** 冲突处理策略 */
export const MERGE_STRATEGIES = [
  { value: 'overwrite', label: '覆盖同名命令' },
  { value: 'skip', label: '跳过同名命令' },
  { value: 'rename', label: '重命名后导入' }
]

function toText(value) {
  return value === undefined || value === null ? '' : String(value)
}

/** 组装导出内容 */
export function buildExportPayload(commands, categories) {
  return {
    version: EXPORT_VERSION,
    app: 'QuicklyCommand',
    exportedAt: new Date().toISOString(),
    commands: (commands || []).map((command) => ({
      id: command.id,
      name: command.name,
      description: command.description,
      category: command.category,
      tags: command.tags,
      icon: command.icon,
      action: command.action,
      options: command.options,
      favorite: command.favorite,
      enabled: command.enabled,
      order: command.order,
      runCount: command.runCount,
      lastRunAt: command.lastRunAt,
      createdAt: command.createdAt,
      updatedAt: command.updatedAt
    })),
    categories: (categories || []).map((category) => ({
      id: category.id,
      name: category.name,
      order: category.order,
      createdAt: category.createdAt
    }))
  }
}

/**
 * 导出到文件。
 * @returns {Promise<{ok: boolean, message: string, path?: string}>}
 */
export async function exportToFile(commands, categories) {
  const payload = buildExportPayload(commands, categories)
  const json = `${JSON.stringify(payload, null, 2)}\n`

  const target = await services.pickSavePath({
    title: '导出快命令配置',
    defaultPath: `quick-commands-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON 文件', extensions: ['json'] }]
  })
  if (!target) {
    return { ok: false, message: '已取消导出' }
  }

  const res = await services.writeTextFile(target, json)
  if (!res.ok) {
    return { ok: false, message: res.error || '写入失败' }
  }
  return { ok: true, message: `已导出到 ${target}`, path: target }
}

/**
 * 解析导入文件内容。
 * @returns {{ok: boolean, message?: string, data?: object}}
 */
export function parseImportPayload(content) {
  let data
  try {
    data = JSON.parse(toText(content))
  } catch (err) {
    return { ok: false, message: `JSON 解析失败：${err.message}` }
  }
  if (!data || typeof data !== 'object') {
    return { ok: false, message: '文件格式不正确' }
  }
  if (!Array.isArray(data.commands)) {
    return { ok: false, message: '文件格式不正确：缺少 commands 数组' }
  }
  return { ok: true, data }
}

/**
 * 选择并读取一个导入文件。
 * @returns {Promise<{ok: boolean, message?: string, data?: object, path?: string}>}
 */
export async function pickImportFile() {
  const files = await services.pickFiles({
    title: '选择要导入的配置文件',
    properties: ['openFile'],
    filters: [{ name: 'JSON 文件', extensions: ['json'] }]
  })
  if (!files || !files.length) {
    return { ok: false, message: '已取消导入' }
  }
  const res = await services.readTextFile(files[0])
  if (!res.ok) {
    return { ok: false, message: res.error || '读取文件失败' }
  }
  const parsed = parseImportPayload(res.content)
  if (!parsed.ok) {
    return { ok: false, message: parsed.message }
  }
  return { ok: true, data: parsed.data, path: files[0] }
}

/**
 * 把导入内容合并进现有数据。
 *
 * @param {object} payload 解析后的导入内容
 * @param {'overwrite'|'skip'|'rename'} strategy 冲突处理策略
 * @returns {{ok: boolean, message: string, added: number, updated: number, skipped: number, categories: number}}
 */
export function mergeImport(payload, strategy = 'overwrite') {
  if (!payload || !Array.isArray(payload.commands)) {
    return { ok: false, message: '导入内容无效', added: 0, updated: 0, skipped: 0, categories: 0 }
  }

  const existingCommands = listCommands()
  const existingCategories = listCategories()
  /** name → 命令对象（导入过程中保存的命令也会回填进来） */
  const byName = new Map(existingCommands.map((command) => [command.name, command]))
  const existingCategoryNames = new Set(existingCategories.map((category) => category.name))

  let added = 0
  let updated = 0
  let skipped = 0

  // 分类
  let categories = 0
  for (const category of payload.categories || []) {
    const name = toText(category.name).trim()
    if (!name) continue
    if (existingCategoryNames.has(name)) continue
    saveCategory({ id: category.id || uuid(), name, order: category.order, createdAt: category.createdAt })
    existingCategoryNames.add(name)
    categories += 1
  }

  // 命令
  for (const command of payload.commands) {
    const name = toText(command.name).trim()
    if (!name) {
      skipped += 1
      continue
    }
    const conflict = byName.get(name)

    if (conflict) {
      if (strategy === 'skip') {
        skipped += 1
        continue
      }
      if (strategy === 'rename') {
        let candidate = `${name} (导入)`
        let index = 2
        while (byName.has(candidate)) {
          candidate = `${name} (导入 ${index})`
          index += 1
        }
        const saved = saveCommand({
          ...command,
          id: uuid(),
          name: candidate,
          category: toText(command.category) || '未分类'
        })
        byName.set(candidate, saved)
        added += 1
        continue
      }
      // overwrite：沿用已有命令的 id，实现真正的「更新」
      const saved = saveCommand({
        ...command,
        id: conflict.id,
        name,
        category: toText(command.category) || conflict.category || '未分类'
      })
      byName.set(name, saved)
      updated += 1
      continue
    }

    const saved = saveCommand({
      ...command,
      id: command.id || uuid(),
      name,
      category: toText(command.category) || '未分类'
    })
    byName.set(name, saved)
    added += 1
  }

  return {
    ok: true,
    message: `导入完成：新增 ${added} 条，更新 ${updated} 条，跳过 ${skipped} 条，新增分类 ${categories} 个`,
    added,
    updated,
    skipped,
    categories
  }
}
