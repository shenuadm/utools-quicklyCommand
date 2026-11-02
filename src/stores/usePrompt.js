/**
 * 全局输入框
 *
 * 用于「命令需要一段输入文本」这类场景（例如从列表里直接运行一条需要文本的命令）。
 */

import { reactive } from 'vue'

export const promptState = reactive({
  open: false,
  title: '',
  message: '',
  placeholder: '',
  value: '',
  multiline: false,
  confirmText: '确定',
  cancelText: '取消',
  resolver: null
})

/**
 * 弹出一个输入框。
 * @param {{title?: string, message?: string, placeholder?: string, value?: string, multiline?: boolean, confirmText?: string}} options
 * @returns {Promise<string|null>} 确认返回文本，取消返回 null
 */
export function promptDialog(options = {}) {
  return new Promise((resolve) => {
    promptState.title = options.title || '请输入内容'
    promptState.message = options.message || ''
    promptState.placeholder = options.placeholder || ''
    promptState.value = options.value || ''
    promptState.multiline = !!options.multiline
    promptState.confirmText = options.confirmText || '确定'
    promptState.cancelText = options.cancelText || '取消'
    promptState.resolver = resolve
    promptState.open = true
  })
}

/** 关闭并返回结果 */
export function resolvePrompt(value) {
  promptState.open = false
  const resolver = promptState.resolver
  promptState.resolver = null
  if (resolver) resolver(value === null ? null : String(value))
}
