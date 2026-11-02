/**
 * preload 桥接层
 *
 * 前端渲染进程没有 Node.js 能力，所有本地操作（剪贴板、Shell、脚本、文件读写）
 * 都必须经由这里暴露出去。
 *
 * 遵循 uTools 官方「最小暴露」原则：
 *   - 统一挂载在 window.services 命名空间下；
 *   - 不把 fs / child_process / vm 等高权限对象直接暴露给前端；
 *   - 每个入口都自行校验入参并捕获异常。
 */

const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { exec } = require('node:child_process')
const vm = require('node:vm')
const { clipboard } = require('electron')

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_BUFFER_BYTES = 4 * 1024 * 1024
const DEFAULT_SHELL_TIMEOUT = 120000
const MAX_SHELL_TIMEOUT = 300000
const DEFAULT_SCRIPT_TIMEOUT = 5000
const MAX_SCRIPT_TIMEOUT = 30000

/** 统一把任意值转成字符串，null / undefined 视为空串 */
function toText(value) {
  return value === undefined || value === null ? '' : String(value)
}

/** 安全 JSON 序列化，用于脚本返回值 */
function safeStringify(value) {
  if (typeof value === 'string') return value
  try {
    const json = JSON.stringify(value, null, 2)
    return json === undefined ? String(value) : json
  } catch (err) {
    return String(value)
  }
}

/** 只透传白名单字段，避免前端传入任意结构 */
function pick(source, keys) {
  const result = {}
  if (!source || typeof source !== 'object') return result
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      result[key] = source[key]
    }
  }
  return result
}

/** 归一化 showOpenDialog / showSaveDialog 的 filters */
function pickFilters(filters) {
  if (!Array.isArray(filters)) return undefined
  const result = filters
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      name: toText(item.name),
      extensions: Array.isArray(item.extensions)
        ? item.extensions.map((ext) => toText(ext).replace(/^\./, '')).filter(Boolean)
        : []
    }))
    .filter((item) => item.name || item.extensions.length)
  return result.length ? result : undefined
}

const services = {
  platform: {
    isWindows: process.platform === 'win32',
    isMacOS: process.platform === 'darwin',
    isLinux: process.platform === 'linux',
    arch: os.arch(),
    platform: process.platform
  },

  /* ---------------------------------------------------------------- 剪贴板 */

  getClipboardText() {
    try {
      return clipboard.readText()
    } catch (err) {
      return ''
    }
  },

  /* ------------------------------------------------------------------ 命令 */

  /**
   * 执行一条本地 Shell 命令。
   * @returns {Promise<{ok: boolean, code: number, stdout: string, stderr: string, error: string}>}
   */
  runShell(command, options = {}) {
    return new Promise((resolve) => {
      const cmd = toText(command).trim()
      if (!cmd) {
        resolve({ ok: false, code: 1, stdout: '', stderr: '', error: '命令为空' })
        return
      }
      const rawTimeout = Number(options && options.timeout)
      const timeout =
        rawTimeout > 0 ? Math.min(rawTimeout, MAX_SHELL_TIMEOUT) : DEFAULT_SHELL_TIMEOUT
      const cwd = toText(options && options.cwd)

      exec(
        cmd,
        {
          cwd: cwd || undefined,
          timeout,
          windowsHide: true,
          maxBuffer: MAX_BUFFER_BYTES,
          encoding: 'utf8'
        },
        (error, stdout, stderr) => {
          resolve({
            ok: !error,
            code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
            stdout: toText(stdout),
            stderr: toText(stderr),
            error: error ? error.message : ''
          })
        }
      )
    })
  },

  /* ------------------------------------------------------------------ 脚本 */

  /**
   * 在 vm 沙箱中执行一段用户脚本。
   * 脚本可用变量：text / selection / clipboard；返回值即脚本的 return 值。
   * @returns {Promise<{ok: boolean, result: string, logs: string[], error: string}>}
   */
  runScript(code, context = {}, options = {}) {
    const logs = []
    const rawTimeout = Number(options && options.timeout)
    const timeout =
      rawTimeout > 0 ? Math.min(rawTimeout, MAX_SCRIPT_TIMEOUT) : DEFAULT_SCRIPT_TIMEOUT

    const record = (level) => (...args) => {
      logs.push(`${level}: ${args.map((arg) => safeStringify(arg)).join(' ')}`)
    }

    const sandbox = {
      console: {
        log: record('log'),
        info: record('info'),
        warn: record('warn'),
        error: record('error')
      },
      text: toText(context && context.text),
      selection: toText(context && context.selection),
      clipboard: toText(context && context.clipboard),
      JSON,
      Math,
      Date,
      Number,
      String,
      Boolean,
      Array,
      Object,
      RegExp,
      Error,
      isNaN,
      isFinite,
      parseInt,
      parseFloat,
      encodeURIComponent,
      decodeURIComponent,
      encodeURI,
      decodeURI,
      btoa: (value) => Buffer.from(toText(value), 'binary').toString('base64'),
      atob: (value) => Buffer.from(toText(value), 'base64').toString('binary')
    }

    try {
      const source = `(function (text, selection, clipboard) {\n${toText(code)}\n})(text, selection, clipboard)`
      const script = new vm.Script(source, { filename: 'quick-command-script.js' })
      const result = script.runInNewContext(sandbox, { timeout, displayErrors: true })
      return {
        ok: true,
        result: result === undefined ? '' : safeStringify(result),
        logs,
        error: ''
      }
    } catch (err) {
      return {
        ok: false,
        result: '',
        logs,
        error: err && err.message ? err.message : String(err)
      }
    }
  },

  /* ------------------------------------------------------------------ 文件 */

  readTextFile(filePath) {
    return new Promise((resolve) => {
      const target = toText(filePath)
      if (!target) {
        resolve({ ok: false, content: '', error: '文件路径为空' })
        return
      }
      try {
        const stat = fs.statSync(target)
        if (!stat.isFile()) {
          resolve({ ok: false, content: '', error: '不是一个文件' })
          return
        }
        if (stat.size > MAX_FILE_BYTES) {
          resolve({ ok: false, content: '', error: '文件超过 5MB 限制' })
          return
        }
        resolve({ ok: true, content: fs.readFileSync(target, 'utf-8'), error: '' })
      } catch (err) {
        resolve({ ok: false, content: '', error: err.message })
      }
    })
  },

  writeTextFile(filePath, content) {
    return new Promise((resolve) => {
      const target = toText(filePath)
      if (!target) {
        resolve({ ok: false, error: '文件路径为空' })
        return
      }
      const data = toText(content)
      if (Buffer.byteLength(data, 'utf-8') > MAX_FILE_BYTES) {
        resolve({ ok: false, error: '内容超过 5MB 限制' })
        return
      }
      try {
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, data, 'utf-8')
        resolve({ ok: true, error: '' })
      } catch (err) {
        resolve({ ok: false, error: err.message })
      }
    })
  },

  /* ------------------------------------------------------------------ 对话框 */

  pickFiles(options = {}) {
    const opts = pick(options, ['title', 'defaultPath', 'buttonLabel', 'message', 'properties'])
    const filters = pickFilters(options && options.filters)
    if (filters) opts.filters = filters
    try {
      const files = utools.showOpenDialog(opts)
      return Promise.resolve(Array.isArray(files) ? files : [])
    } catch (err) {
      return Promise.resolve([])
    }
  },

  pickSavePath(options = {}) {
    const opts = pick(options, ['title', 'defaultPath', 'buttonLabel', 'message', 'properties'])
    const filters = pickFilters(options && options.filters)
    if (filters) opts.filters = filters
    try {
      const target = utools.showSaveDialog(opts)
      return Promise.resolve(toText(target))
    } catch (err) {
      return Promise.resolve('')
    }
  },

  /* ------------------------------------------------------------------ 打开 */

  openPath(target) {
    const fullPath = toText(target)
    if (!fullPath) return Promise.resolve('路径为空')
    try {
      return Promise.resolve(utools.shellOpenPath(fullPath))
    } catch (err) {
      return Promise.resolve(err.message)
    }
  },

  showInFolder(target) {
    const fullPath = toText(target)
    if (!fullPath) return
    try {
      utools.shellShowItemInFolder(fullPath)
    } catch (err) {
      /* 忽略：资源管理器不可用时无需打断用户 */
    }
  },

  /* ------------------------------------------------------------------ 目录 */

  getLocalDataPath() {
    try {
      return utools.getPluginLocalDataPath()
    } catch (err) {
      return ''
    }
  },

  getTempPath() {
    try {
      return utools.getPluginTempPath()
    } catch (err) {
      return os.tmpdir()
    }
  },

  getDownloadsPath() {
    try {
      return utools.getPath('downloads')
    } catch (err) {
      return path.join(os.homedir(), 'Downloads')
    }
  },

  getUserHome() {
    return os.homedir()
  }
}

window.services = services
