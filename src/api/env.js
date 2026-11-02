/**
 * 运行环境适配层
 *
 * `window.utools` 与 `window.services` 只在 uTools Runtime 中存在。
 * 为了能在普通浏览器里用 `npm run dev` 自测，这里为浏览器环境提供一份内存版
 * mock；进入 uTools 后所有调用都会走真实 API。
 */

const hasUtools = typeof window !== 'undefined' && !!window.utools
const hasServices = typeof window !== 'undefined' && !!window.services

export const isUtools = hasUtools

/* --------------------------------------------------------------- mock db */

function createMockDb() {
  const docs = new Map()
  let rev = 0
  const nextRev = () => `1-${++rev}`

  const db = {
    put(doc) {
      // 新建文档不能带 _rev 这个键（哪怕值是 undefined）
      if (Object.prototype.hasOwnProperty.call(doc, '_rev') && doc._rev === undefined) {
        return {
          id: doc._id,
          ok: false,
          error: true,
          name: 'bad_request',
          message: 'Document cannot be inserted with _rev'
        }
      }
      // 与真实 uTools 一致：更新已有文档必须带上匹配的 _rev
      const current = docs.get(doc._id)
      if (current && doc._rev !== current._rev) {
        return {
          id: doc._id,
          ok: false,
          error: true,
          name: 'conflict',
          message: 'Document update conflict'
        }
      }
      const record = { ...doc, _rev: nextRev() }
      docs.set(doc._id, record)
      return { id: doc._id, rev: record._rev, ok: true }
    },
    get(id) {
      const found = docs.get(id)
      return found ? { ...found } : null
    },
    remove(docOrId) {
      const id = typeof docOrId === 'string' ? docOrId : docOrId._id
      const existed = docs.delete(id)
      return { id, ok: existed }
    },
    bulkDocs(list) {
      return list.map((doc) => db.put(doc))
    },
    allDocs(filter) {
      const all = Array.from(docs.values()).map((doc) => ({ ...doc }))
      if (!filter) return all
      if (typeof filter === 'string') return all.filter((doc) => doc._id.startsWith(filter))
      if (Array.isArray(filter)) {
        return filter
          .map((id) => docs.get(id))
          .filter(Boolean)
          .map((doc) => ({ ...doc }))
      }
      return all
    }
  }

  db.promises = {
    put: async (doc) => db.put(doc),
    get: async (id) => db.get(id),
    remove: async (docOrId) => db.remove(docOrId),
    bulkDocs: async (list) => db.bulkDocs(list),
    allDocs: async (filter) => db.allDocs(filter)
  }
  return db
}

/* ------------------------------------------------------- mock dbStorage */

function createMockDbStorage() {
  const store = new Map()
  return {
    setItem: (key, value) => {
      store.set(key, value)
    },
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    removeItem: (key) => store.delete(key)
  }
}

/* --------------------------------------------------------- mock services */

function createMockServices() {
  return {
    platform: {
      isWindows: true,
      isMacOS: false,
      isLinux: false,
      arch: 'x64',
      platform: 'browser'
    },
    getClipboardText: async () => {
      try {
        return await navigator.clipboard.readText()
      } catch (err) {
        return ''
      }
    },
    runShell: async () => ({
      ok: false,
      code: 1,
      stdout: '',
      stderr: '',
      error: '浏览器环境不支持执行本地命令'
    }),
    runScript: async (code) => {
      console.info('[mock] runScript', code)
      return {
        ok: false,
        result: '',
        logs: [],
        error: '浏览器环境不支持执行脚本'
      }
    },
    readTextFile: async () => ({
      ok: false,
      content: '',
      error: '浏览器环境不支持读取本地文件'
    }),
    writeTextFile: async () => ({ ok: false, error: '浏览器环境不支持写入本地文件' }),
    pickFiles: async () => [],
    pickSavePath: async () => '',
    openPath: async () => '浏览器环境不支持打开本地路径',
    showInFolder: () => {},
    getLocalDataPath: () => '',
    getTempPath: () => '',
    getDownloadsPath: () => '',
    getUserHome: () => ''
  }
}

/* ----------------------------------------------------------- mock utools */

function createMockUtools() {
  const dynamicFeatures = new Map()
  const toolHandlers = new Map()
  const eventHandlers = { enter: [], out: [], ready: [], mainPush: [] }

  const mock = {
    db: createMockDb(),
    dbStorage: createMockDbStorage(),

    onPluginReady(callback) {
      Promise.resolve(callback()).catch(() => {})
    },
    onPluginEnter(callback) {
      eventHandlers.enter.push(callback)
    },
    onPluginOut(callback) {
      eventHandlers.out.push(callback)
    },
    onDbPull(callback) {
      /* 浏览器环境没有云同步 */
    },
    onMainPush(callback) {
      eventHandlers.mainPush.push(callback)
    },

    setFeature(feature) {
      dynamicFeatures.set(feature.code, feature)
      console.info('[mock] setFeature', feature.code)
    },
    getFeatures(codes) {
      const all = Array.from(dynamicFeatures.values())
      if (!codes) return all
      return all.filter((feature) => codes.includes(feature.code))
    },
    removeFeature(code) {
      const existed = dynamicFeatures.delete(code)
      console.info('[mock] removeFeature', code)
      return existed
    },

    registerTool(name, handler) {
      toolHandlers.set(name, handler)
      console.info('[mock] registerTool', name)
    },

    copyText(text) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(String(text ?? '')).catch(() => {})
      }
      console.info('[mock] copyText', text)
      return true
    },
    copyFile: () => true,
    copyImage: () => true,
    getCopiedFiles: () => null,

    shellOpenExternal(url) {
      console.info('[mock] shellOpenExternal', url)
      window.open(url, '_blank')
      return Promise.resolve()
    },
    shellOpenPath: (target) => {
      console.info('[mock] shellOpenPath', target)
      return Promise.resolve('')
    },
    shellShowItemInFolder: (target) => console.info('[mock] shellShowItemInFolder', target),
    shellBeep: () => {},

    showOpenDialog: () => undefined,
    showSaveDialog: () => undefined,

    showNotification(body, code) {
      console.info('[mock] showNotification', body, code || '')
    },

    redirect(label, payload) {
      console.info('[mock] redirect', label, payload)
      return true
    },
    redirectHotKeySetting: (label) => console.info('[mock] redirectHotKeySetting', label),
    getCmdHotKey: () => null,

    isDarkColors: () =>
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches,
    isWindows: () => false,
    isMacOS: () => false,
    isLinux: () => false,
    isDev: () => true,

    setExpandHeight: (height) => {
      console.info('[mock] setExpandHeight', height)
      return true
    },
    hideMainWindow: () => true,
    showMainWindow: () => true,
    outPlugin: () => {},

    getPath: (name) => `/mock/${name}`,
    getPluginLocalDataPath: () => '',
    getPluginTempPath: () => '',
    getUser: () => ({ avatar: '', nickname: '本地开发' }),
    getNativeId: () => 'mock-plugin-id',
    getAppVersion: () => 'dev',
    getFileIcon: () => '',
    getFileIconAsync: async () => '',

    registerToolHandlers: toolHandlers
  }

  /**
   * 浏览器调试辅助：在控制台里模拟一次插件进入。
   * window.mockEnter('qc-manager', 'text', 'payload')
   */
  if (typeof window !== 'undefined') {
    window.mockEnter = (code, type = 'text', payload = '') => {
      eventHandlers.enter.forEach((callback) => callback({ code, type, payload, from: 'main' }))
    }
    window.mockPush = (query = '') => {
      const action = { code: 'qc-launcher', type: 'text', payload: query }
      const results = eventHandlers.mainPush.length ? eventHandlers.mainPush[0](action) : []
      console.info('[mock] mainPush', query, results)
      return results
    }
    window.mockTools = toolHandlers
  }

  return mock
}

/* ------------------------------------------------------------------ 导出 */

export const utools = hasUtools ? window.utools : createMockUtools()
export const services = hasServices ? window.services : createMockServices()

/** 读取剪贴板文本（uTools 没有对应 API，需经 preload 桥接） */
export async function readClipboardText() {
  try {
    const text = await services.getClipboardText()
    return text === undefined || text === null ? '' : String(text)
  } catch (err) {
    return ''
  }
}
