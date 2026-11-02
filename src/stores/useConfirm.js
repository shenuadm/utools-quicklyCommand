/**
 * 全局确认对话框
 *
 * 用一个响应式状态 + Promise 的方式，让任何模块都能弹出确认框。
 */

import { reactive } from 'vue'

export const confirmState = reactive({
  open: false,
  title: '',
  message: '',
  detail: '',
  confirmText: '确定',
  cancelText: '取消',
  danger: false,
  resolver: null
})

/**
 * 弹出一个确认框。
 * @param {{title?: string, message?: string, detail?: string, confirmText?: string, cancelText?: string, danger?: boolean}} options
 * @returns {Promise<boolean>}
 */
export function confirmDialog(options = {}) {
  return new Promise((resolve) => {
    confirmState.title = options.title || '确认操作'
    confirmState.message = options.message || ''
    confirmState.detail = options.detail || ''
    confirmState.confirmText = options.confirmText || '确定'
    confirmState.cancelText = options.cancelText || '取消'
    confirmState.danger = !!options.danger
    confirmState.resolver = resolve
    confirmState.open = true
  })
}

/** 关闭并返回结果 */
export function resolveConfirm(value) {
  confirmState.open = false
  const resolver = confirmState.resolver
  confirmState.resolver = null
  if (resolver) resolver(!!value)
}
