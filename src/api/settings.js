/**
 * 设置与轻量状态存储
 *
 * 使用 uTools.dbStorage（同步 KV，参与 uTools 数据同步），适合存放偏好设置、
 * 小体量状态。命令与分类等结构化用户数据走 utools.db。
 */

import { utools } from './env.js'

const SETTINGS_KEY = 'qc.settings'
const FEATURE_CODES_KEY = 'qc.dynamicFeatureCodes'
const FEATURE_SNAPSHOT_KEY = 'qc.dynamicFeatureSnapshot'
const RUN_LOG_KEY = 'qc.runLog'

/** 运行日志上限 */
export const RUN_LOG_LIMIT = 1000

export const DEFAULT_SETTINGS = {
  /** auto | light | dark */
  theme: 'auto',
  /** 是否把启用的快命令注册为 uTools 动态功能 */
  registerFeatures: true,
  /** 是否在 uTools 搜索框实时推送快命令（mainPush） */
  mainPushRecommend: true,
  /** 执行 shell / script 前是否确认 */
  confirmBeforeRun: true,
  /** 列表中是否显示已禁用的命令 */
  showDisabled: false,
  /** 新建命令的默认分类 */
  defaultCategory: ''
}

function readJson(key, fallback) {
  try {
    const value = utools.dbStorage.getItem(key)
    if (value === null || value === undefined) return fallback
    return value
  } catch (err) {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    utools.dbStorage.setItem(key, value)
  } catch (err) {
    console.error('[settings] 写入失败', key, err)
  }
}

/** 读取全部设置 */
export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...readJson(SETTINGS_KEY, {}) }
}

/** 合并式更新设置 */
export function saveSettings(patch) {
  const next = { ...getSettings(), ...(patch || {}) }
  writeJson(SETTINGS_KEY, next)
  return next
}

/** 读取本插件已注册的动态功能 code 清单 */
export function getOwnedFeatureCodes() {
  const codes = readJson(FEATURE_CODES_KEY, [])
  return Array.isArray(codes) ? codes.filter((code) => typeof code === 'string') : []
}

/** 回写本插件已注册的动态功能 code 清单 */
export function setOwnedFeatureCodes(codes) {
  writeJson(FEATURE_CODES_KEY, Array.isArray(codes) ? codes : [])
}

/**
 * 读取上一次注册的动态功能快照（code → 序列化后的 feature）。
 * 用于跳过没有变化的 setFeature 调用，减少 uTools 侧的重复写入。
 */
export function getFeatureSnapshot() {
  const snapshot = readJson(FEATURE_SNAPSHOT_KEY, {})
  return snapshot && typeof snapshot === 'object' ? snapshot : {}
}

/** 回写动态功能快照 */
export function setFeatureSnapshot(snapshot) {
  writeJson(FEATURE_SNAPSHOT_KEY, snapshot || {})
}

/** 读取运行日志 */
export function getRunLog() {
  const log = readJson(RUN_LOG_KEY, [])
  return Array.isArray(log) ? log : []
}

/**
 * 追加一条运行记录，超出上限时丢弃最旧的。
 * @param {{id: string, name: string, actionType: string, category: string}} entry
 */
export function appendRunLog(entry) {
  const log = getRunLog()
  log.unshift({ ...entry, at: Date.now() })
  if (log.length > RUN_LOG_LIMIT) {
    log.length = RUN_LOG_LIMIT
  }
  writeJson(RUN_LOG_KEY, log)
  return log
}

/** 清空运行日志 */
export function clearRunLog() {
  writeJson(RUN_LOG_KEY, [])
}
