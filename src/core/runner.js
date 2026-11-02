/**
 * 快命令执行引擎
 *
 * 流程：解析输入文本 → 渲染模板 → 按动作类型分发 → 记录统计 → 复制/通知。
 */

import { utools, services, readClipboardText } from '../api/env.js'
import { appendRunLog } from '../api/settings.js'
import { recordRun } from '../api/db.js'
import { renderTemplate, actionUsesVariable } from '../core/actions.js'
import { engineTemplate, engineName } from '../core/engines.js'
import { applyTransform, transformName } from '../core/transforms.js'

const DEFAULT_OPTIONS = {
  useSelection: true,
  useClipboard: false,
  copyResult: false,
  notify: true,
  silent: false
}

function toText(value) {
  return value === undefined || value === null ? '' : String(value)
}

function fail(message, extra = {}) {
  return { ok: false, message, output: '', error: message, ...extra }
}

/**
 * 解析本次执行可用的变量。
 * @param {object} command 快命令
 * @param {{text?: string, selection?: string}} context 调用方提供的输入
 * @param {object} options 命令选项
 */
async function resolveVars(command, context, options) {
  const vars = { text: '', selection: '', clipboard: '' }
  vars.selection = toText(context.selection)

  const explicit = context.text !== undefined && context.text !== null ? toText(context.text) : ''
  vars.text = explicit || (options.useSelection ? vars.selection : '')

  const wantsClipboard = actionUsesVariable(command.action, 'clipboard')
  if (wantsClipboard || (!vars.text && options.useClipboard)) {
    vars.clipboard = await readClipboardText()
    if (!vars.text && options.useClipboard) {
      vars.text = vars.clipboard
    }
  }
  return vars
}

/** 按动作类型分发 */
async function dispatch(action, vars) {
  switch (action.type) {
    case 'openUrl': {
      const url = renderTemplate(action.url, vars, { urlEncode: true }).trim()
      if (!url) return fail('网址为空')
      await utools.shellOpenExternal(url)
      return { ok: true, message: `已打开 ${url}`, output: url, error: '' }
    }

    case 'search': {
      const template = engineTemplate(action.engine, action.urlTemplate)
      if (!template) return fail('未配置搜索 URL')
      const url = renderTemplate(template, vars, { urlEncode: true })
      await utools.shellOpenExternal(url)
      return {
        ok: true,
        message: `已在 ${engineName(action.engine)} 搜索`,
        output: url,
        error: ''
      }
    }

    case 'transform': {
      const output = applyTransform(action.transform, vars.text)
      return { ok: true, message: `已${transformName(action.transform)}`, output, error: '' }
    }

    case 'shell': {
      const commandText = renderTemplate(action.command, vars)
      const res = await services.runShell(commandText, {
        cwd: action.cwd,
        timeout: action.timeout
      })
      const output = [res.stdout, res.stderr].filter(Boolean).join('\n').trim()
      if (!res.ok) {
        return {
          ok: false,
          message: res.error || `命令退出码 ${res.code}`,
          output,
          error: res.error || ''
        }
      }
      return { ok: true, message: '命令执行成功', output, error: '' }
    }

    case 'script': {
      const res = await services.runScript(action.code, vars, { timeout: action.timeout })
      const output = [res.result, (res.logs || []).join('\n')].filter(Boolean).join('\n').trim()
      if (!res.ok) {
        return { ok: false, message: res.error || '脚本执行失败', output, error: res.error || '' }
      }
      return { ok: true, message: '脚本执行成功', output, error: '' }
    }

    case 'openPath': {
      const target = renderTemplate(action.path, vars).trim()
      if (!target) return fail('路径为空')
      if (action.reveal) {
        services.showInFolder(target)
        return { ok: true, message: `已在文件管理器中定位 ${target}`, output: target, error: '' }
      }
      const res = await services.openPath(target)
      if (typeof res === 'string' && res) {
        return { ok: false, message: res, output: '', error: res }
      }
      return { ok: true, message: `已打开 ${target}`, output: target, error: '' }
    }

    case 'copy': {
      const content = toText(action.text) ? renderTemplate(action.text, vars) : vars.text
      const ok = utools.copyText(content)
      if (!ok) return fail('复制失败')
      return { ok: true, message: '已复制到剪贴板', output: content, error: '' }
    }

    case 'redirect': {
      const targetName = toText(action.target).trim()
      const pluginName = toText(action.plugin).trim()
      if (!targetName) return fail('未配置目标指令')
      const label = pluginName ? [pluginName, targetName] : targetName
      const payload = toText(action.payload) ? renderTemplate(action.payload, vars) : undefined
      const ok = utools.redirect(label, payload)
      if (!ok) return fail(`未找到指令「${targetName}」`)
      return {
        ok: true,
        message: `已跳转到 ${pluginName ? `${pluginName} / ` : ''}${targetName}`,
        output: '',
        error: ''
      }
    }

    default:
      return fail(`未知的动作类型：${action.type}`)
  }
}

/**
 * 执行一条快命令。
 *
 * @param {object} command 快命令对象
 * @param {{text?: string, selection?: string}} [context] 本次执行的输入文本
 * @returns {Promise<{ok: boolean, message: string, output: string, error: string, command?: object}>}
 */
export async function runCommand(command, context = {}) {
  const options = { ...DEFAULT_OPTIONS, ...(command.options || {}) }
  const action = command.action || {}

  let result
  try {
    const vars = await resolveVars(command, context, options)
    result = await dispatch(action, vars)
  } catch (err) {
    result = fail(err && err.message ? err.message : '执行失败')
  }

  // 统计
  try {
    result.command = recordRun(command)
  } catch (err) {
    console.error('[runner] 记录统计失败', err)
  }
  try {
    appendRunLog({
      id: command.id,
      name: command.name,
      actionType: action.type,
      category: command.category
    })
  } catch (err) {
    console.error('[runner] 写入运行日志失败', err)
  }

  // 结果复制
  if (result.ok && options.copyResult && result.output) {
    try {
      utools.copyText(result.output)
      result.message = `${result.message}，结果已复制到剪贴板`
    } catch (err) {
      /* 复制失败不影响执行结果 */
    }
  }

  // 通知
  if (options.notify && !options.silent) {
    try {
      const body = result.ok
        ? `${command.name}：${result.message}`
        : `${command.name} 执行失败：${result.message}`
      utools.showNotification(body, 'qc-manager')
    } catch (err) {
      /* 通知失败不影响执行结果 */
    }
  }

  // 静默模式：执行完直接收起窗口
  if (options.silent) {
    try {
      utools.hideMainWindow()
    } catch (err) {
      /* 忽略 */
    }
  }

  return result
}
