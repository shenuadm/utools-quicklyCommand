/**
 * 动态功能对账
 *
 * 把「启用的快命令」同步成 uTools 动态功能，使用户可以直接在 uTools 搜索框
 * 和超级面板中命中并执行，无需先打开插件。
 *
 * 对账策略：
 *   期望集合 = 已启用的快命令 → utools.setFeature
 *   归属清单 − 期望集合       → utools.removeFeature
 *   回写归属清单（存 dbStorage，便于插件重装后清理残留）
 */

import { utools } from './env.js'
import {
  getOwnedFeatureCodes,
  setOwnedFeatureCodes,
  getFeatureSnapshot,
  setFeatureSnapshot
} from './settings.js'
import { actionUsesText } from '../core/actions.js'
import { featureIcon } from '../core/command-icon.js'

/** 动态功能 code 前缀，与 plugin.json 中声明的 feature.code 严格隔离 */
export const DYNAMIC_PREFIX = 'qc-run-'

/** 动态功能 code ↔ 快命令 id */
export function featureCodeOf(commandId) {
  return DYNAMIC_PREFIX + commandId
}

/** 从动态功能 code 反推快命令 id */
export function commandIdOfFeatureCode(code) {
  return toText(code).startsWith(DYNAMIC_PREFIX) ? toText(code).slice(DYNAMIC_PREFIX.length) : ''
}

function toText(value) {
  return value === undefined || value === null ? '' : String(value)
}

/**
 * 组装动态功能的 cmds。
 * 始终包含一个功能指令；只有真正消费文本的命令才额外挂上文本匹配指令，
 * 避免超级面板被无意义的入口淹没。
 */
export function buildCmds(command) {
  const cmds = [command.name]
  if (actionUsesText(command.action)) {
    cmds.push({
      type: 'over',
      label: `${command.name}·文本`,
      minLength: 1,
      maxLength: 100000
    })
  }
  return cmds
}

/**
 * 全量同步动态功能。
 * @param {Array<object>} commands 全部快命令
 * @param {{register?: boolean}} [options] register 为 false 时只清理不注册
 * @returns {{registered: number, removed: number, failed: string[]}}
 */
export function syncDynamicFeatures(commands, options = {}) {
  const { register = true } = options
  const owned = getOwnedFeatureCodes()
  const snapshot = getFeatureSnapshot()
  const failed = []

  const desired = new Map()
  if (register) {
    for (const command of commands || []) {
      if (!command.enabled) continue
      desired.set(featureCodeOf(command.id), command)
    }
  }

  // 清理不再需要的动态功能
  for (const code of owned) {
    if (desired.has(code)) continue
    try {
      utools.removeFeature(code)
    } catch (err) {
      failed.push(`移除 ${code} 失败：${err.message}`)
    }
  }

  // 注册 / 更新（内容没变化的跳过，避免反复调用 uTools）
  const nextSnapshot = {}
  for (const [code, command] of desired) {
    const feature = {
      code,
      description: command.description || `执行「${command.name}」`,
      icon: featureIcon(command),
      mainHide: !!command.options?.silent,
      cmds: buildCmds(command)
    }
    const serialized = JSON.stringify(feature)
    nextSnapshot[code] = serialized
    if (snapshot[code] === serialized) continue
    try {
      utools.setFeature(feature)
    } catch (err) {
      failed.push(`注册 ${command.name} 失败：${err.message}`)
    }
  }

  setOwnedFeatureCodes(Array.from(desired.keys()))
  setFeatureSnapshot(nextSnapshot)
  return {
    registered: desired.size,
    removed: owned.filter((code) => !desired.has(code)).length,
    failed
  }
}

/**
 * 清理本插件注册过的全部动态功能（卸载插件或关闭注册开关时使用）。
 */
export function clearDynamicFeatures() {
  const owned = getOwnedFeatureCodes()
  for (const code of owned) {
    try {
      utools.removeFeature(code)
    } catch (err) {
      /* 忽略 */
    }
  }
  setOwnedFeatureCodes([])
  setFeatureSnapshot({})
  return owned.length
}
