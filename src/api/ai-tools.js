/**
 * AI 工具注册
 *
 * 官方文档说明：Tool 被调用时，若插件应用未运行，uTools 会启动插件应用并在
 * 初始化阶段执行 registerTool()。因此注册必须发生在模块加载期（main.js），
 * 且 handler 不能依赖 Vue 组件已挂载。
 *
 * 工具名称必须与 public/plugin.json 中 tools 字段声明的名称完全一致，
 * 否则无法通过 MCP 暴露给第三方 AI Agent。
 */

import { utools } from './env.js'
import { listCommands } from './db.js'
import { runCommand } from '../core/runner.js'
import { actionTypeName } from '../core/actions.js'

function toText(value) {
  return value === undefined || value === null ? '' : String(value)
}

/** 把命令压缩成便于 AI 理解的摘要 */
function summarize(command) {
  return {
    name: command.name,
    description: command.description,
    category: command.category,
    tags: command.tags,
    actionType: command.action.type,
    actionTypeName: actionTypeName(command.action.type),
    enabled: command.enabled,
    favorite: command.favorite,
    runCount: command.runCount
  }
}

/** 注册两个 AI 工具 */
export function registerAiTools() {
  if (!utools || typeof utools.registerTool !== 'function') {
    return false
  }

  utools.registerTool('list_quick_commands', async (params = {}) => {
    const category = toText(params.category).trim()
    const keyword = toText(params.keyword).trim().toLowerCase()

    let commands = listCommands()
    if (category) {
      commands = commands.filter((command) => command.category === category)
    }
    if (keyword) {
      commands = commands.filter((command) =>
        [command.name, command.description, ...(command.tags || [])]
          .join(' ')
          .toLowerCase()
          .includes(keyword)
      )
    }

    return {
      total: commands.length,
      commands: commands.map(summarize)
    }
  })

  utools.registerTool('run_quick_command', async (params = {}) => {
    const name = toText(params.name).trim()
    if (!name) {
      return { ok: false, message: '缺少参数 name：需要指定要执行的快命令名称' }
    }

    const commands = listCommands()
    const command =
      commands.find((item) => item.name === name) ||
      commands.find((item) => item.name.toLowerCase() === name.toLowerCase())

    if (!command) {
      const available = commands.slice(0, 20).map((item) => item.name).join('、')
      return {
        ok: false,
        message: `未找到快命令「${name}」。可用命令：${available || '（暂无）'}`
      }
    }

    const result = await runCommand(command, { text: toText(params.text) })
    return {
      ok: !!result.ok,
      message: result.ok ? result.message : result.message || '执行失败',
      output: result.output || ''
    }
  })

  return true
}
