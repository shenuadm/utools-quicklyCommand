/**
 * 内置搜索引擎
 *
 * URL 模板使用统一的 {{text}} 占位符，由 actions.js 的模板渲染器负责编码。
 */

/** 内置引擎 */
export const ENGINES = [
  { id: 'google', name: 'Google', template: 'https://www.google.com/search?q={{text}}' },
  { id: 'bing', name: 'Bing', template: 'https://www.bing.com/search?q={{text}}' },
  { id: 'baidu', name: '百度', template: 'https://www.baidu.com/s?wd={{text}}' },
  { id: 'sogou', name: '搜狗', template: 'https://www.sogou.com/web?query={{text}}' },
  { id: 'so360', name: '360 搜索', template: 'https://www.so.com/s?q={{text}}' },
  { id: 'duckduckgo', name: 'DuckDuckGo', template: 'https://duckduckgo.com/?q={{text}}' },
  { id: 'github', name: 'GitHub 代码', template: 'https://github.com/search?q={{text}}' },
  { id: 'zhihu', name: '知乎', template: 'https://www.zhihu.com/search?q={{text}}' },
  { id: 'bilibili', name: '哔哩哔哩', template: 'https://search.bilibili.com/all?keyword={{text}}' },
  { id: 'youtube', name: 'YouTube', template: 'https://www.youtube.com/results?search_query={{text}}' },
  { id: 'taobao', name: '淘宝', template: 'https://s.taobao.com/search?q={{text}}' },
  { id: 'npm', name: 'npm', template: 'https://www.npmjs.com/search?q={{text}}' },
  { id: 'mdn', name: 'MDN 文档', template: 'https://developer.mozilla.org/zh-CN/search?q={{text}}' }
]

/** 自定义引擎的 id */
export const CUSTOM_ENGINE = 'custom'

/** id → 引擎 */
export const ENGINE_MAP = ENGINES.reduce((acc, item) => {
  acc[item.id] = item
  return acc
}, {})

/**
 * 取引擎的 URL 模板。
 * @param {string} engine 引擎 id
 * @param {string} customTemplate 自定义模板（engine 为 custom 时使用）
 */
export function engineTemplate(engine, customTemplate = '') {
  if (engine === CUSTOM_ENGINE) {
    return customTemplate || ''
  }
  const found = ENGINE_MAP[engine]
  return found ? found.template : ''
}

/** 引擎 id → 名称 */
export function engineName(engine) {
  if (engine === CUSTOM_ENGINE) return '自定义'
  const found = ENGINE_MAP[engine]
  return found ? found.name : engine
}
