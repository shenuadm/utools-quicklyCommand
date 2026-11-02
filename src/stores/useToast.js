/**
 * 轻量 Toast 提示
 *
 * 不引入 UI 框架，用一个响应式数组 + 组件渲染即可。
 */

import { reactive } from 'vue'

export const toasts = reactive([])

let seed = 0

/**
 * 弹出一条提示。
 * @param {string} message 文本
 * @param {'info'|'success'|'error'} [type] 类型
 * @param {number} [duration] 自动消失时间（毫秒），0 表示不自动消失
 */
export function toast(message, type = 'info', duration = 2600) {
  const id = ++seed
  toasts.push({ id, message: String(message ?? ''), type })
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration)
  }
  return id
}

export const toastSuccess = (message, duration) => toast(message, 'success', duration)
export const toastError = (message, duration) => toast(message, 'error', duration ?? 4200)

/** 关闭一条提示 */
export function dismiss(id) {
  const index = toasts.findIndex((item) => item.id === id)
  if (index !== -1) toasts.splice(index, 1)
}
