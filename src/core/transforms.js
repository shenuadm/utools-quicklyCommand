/**
 * 文本转换集合
 *
 * 全部为纯函数，不依赖 DOM / uTools，便于单独测试。
 */

function toText(value) {
  return value === undefined || value === null ? '' : String(value)
}

/** UTF-8 安全的 base64 编码（btoa 只接受 latin1，需要先转字节） */
export function utf8ToBase64(input) {
  const bytes = new TextEncoder().encode(toText(input))
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** UTF-8 安全的 base64 解码 */
export function base64ToUtf8(input) {
  const binary = atob(toText(input).replace(/\s+/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

function toBase64Url(input) {
  return utf8ToBase64(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function words(input) {
  return toText(input)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

function capitalizeWord(word) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

/**
 * 转换器清单。
 * group 用于编辑器里的分组展示。
 */
export const TRANSFORMS = [
  {
    id: 'upper',
    name: '转大写',
    group: '大小写',
    apply: (text) => toText(text).toUpperCase()
  },
  {
    id: 'lower',
    name: '转小写',
    group: '大小写',
    apply: (text) => toText(text).toLowerCase()
  },
  {
    id: 'capitalize',
    name: '首字母大写',
    group: '大小写',
    apply: (text) =>
      toText(text).replace(/\b\p{L}/gu, (char) => char.toUpperCase())
  },
  {
    id: 'camel',
    name: '驼峰命名',
    group: '大小写',
    apply: (text) =>
      words(text)
        .map((word, index) =>
          index === 0 ? word.toLowerCase() : capitalizeWord(word)
        )
        .join('')
  },
  {
    id: 'pascal',
    name: '帕斯卡命名',
    group: '大小写',
    apply: (text) => words(text).map(capitalizeWord).join('')
  },
  {
    id: 'kebab',
    name: '短横线命名',
    group: '大小写',
    apply: (text) => words(text).map((word) => word.toLowerCase()).join('-')
  },
  {
    id: 'snake',
    name: '下划线命名',
    group: '大小写',
    apply: (text) => words(text).map((word) => word.toLowerCase()).join('_')
  },
  {
    id: 'trim',
    name: '去除首尾空白',
    group: '空白',
    apply: (text) => toText(text).trim()
  },
  {
    id: 'noSpace',
    name: '去除所有空白',
    group: '空白',
    apply: (text) => toText(text).replace(/\s+/g, '')
  },
  {
    id: 'spaceToLines',
    name: '空格转换行',
    group: '空白',
    apply: (text) => toText(text).split(/\s+/).filter(Boolean).join('\n')
  },
  {
    id: 'linesToSpace',
    name: '换行转空格',
    group: '空白',
    apply: (text) => toText(text).replace(/\s*\n\s*/g, ' ')
  },
  {
    id: 'reverse',
    name: '反转文本',
    group: '文本',
    apply: (text) => Array.from(toText(text)).reverse().join('')
  },
  {
    id: 'reverseLines',
    name: '反转行序',
    group: '文本',
    apply: (text) => toText(text).split('\n').reverse().join('\n')
  },
  {
    id: 'sortLines',
    name: '行排序',
    group: '文本',
    apply: (text) => toText(text).split('\n').sort((a, b) => a.localeCompare(b, 'zh-CN')).join('\n')
  },
  {
    id: 'dedupeLines',
    name: '去除重复行',
    group: '文本',
    apply: (text) => {
      const seen = new Set()
      return toText(text)
        .split('\n')
        .filter((line) => {
          if (seen.has(line)) return false
          seen.add(line)
          return true
        })
        .join('\n')
    }
  },
  {
    id: 'base64Encode',
    name: 'Base64 编码',
    group: '编码',
    apply: (text) => utf8ToBase64(text)
  },
  {
    id: 'base64Decode',
    name: 'Base64 解码',
    group: '编码',
    apply: (text) => base64ToUtf8(text)
  },
  {
    id: 'base64Url',
    name: 'Base64URL 编码',
    group: '编码',
    apply: (text) => toBase64Url(text)
  },
  {
    id: 'urlEncode',
    name: 'URL 编码',
    group: '编码',
    apply: (text) => encodeURIComponent(toText(text))
  },
  {
    id: 'urlDecode',
    name: 'URL 解码',
    group: '编码',
    apply: (text) => {
      try {
        return decodeURIComponent(toText(text))
      } catch (err) {
        return toText(text)
      }
    }
  },
  {
    id: 'jsonFormat',
    name: 'JSON 格式化',
    group: '编码',
    apply: (text) => {
      try {
        return JSON.stringify(JSON.parse(toText(text)), null, 2)
      } catch (err) {
        throw new Error(`JSON 解析失败：${err.message}`)
      }
    }
  },
  {
    id: 'jsonMinify',
    name: 'JSON 压缩',
    group: '编码',
    apply: (text) => {
      try {
        return JSON.stringify(JSON.parse(toText(text)))
      } catch (err) {
        throw new Error(`JSON 解析失败：${err.message}`)
      }
    }
  },
  {
    id: 'htmlEscape',
    name: 'HTML 转义',
    group: '编码',
    apply: (text) =>
      toText(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
  },
  {
    id: 'htmlUnescape',
    name: 'HTML 反转义',
    group: '编码',
    apply: (text) =>
      toText(text)
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
  },
  {
    id: 'stripHtml',
    name: '去除 HTML 标签',
    group: '文本',
    apply: (text) => toText(text).replace(/<[^>]*>/g, '')
  },
  {
    id: 'extractEmails',
    name: '提取邮箱地址',
    group: '提取',
    apply: (text) => {
      const matched = toText(text).match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)
      return matched ? Array.from(new Set(matched)).join('\n') : ''
    }
  },
  {
    id: 'extractUrls',
    name: '提取链接',
    group: '提取',
    apply: (text) => {
      const matched = toText(text).match(/https?:\/\/[^\s<>"']+/g)
      return matched ? Array.from(new Set(matched)).join('\n') : ''
    }
  },
  {
    id: 'numberFormat',
    name: '数字千分位',
    group: '数字',
    apply: (text) =>
      toText(text).replace(/\d+(?:\.\d+)?/g, (num) => {
        const [intPart, decimalPart] = num.split('.')
        const withSeparator = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        return decimalPart === undefined ? withSeparator : `${withSeparator}.${decimalPart}`
      })
  },
  {
    id: 'countChars',
    name: '字数统计',
    group: '数字',
    apply: (text) => {
      const value = toText(text)
      const chars = Array.from(value).length
      const wordsCount = value.trim() ? value.trim().split(/\s+/).length : 0
      const lines = value ? value.split('\n').length : 0
      return `字符数：${chars}\n词数：${wordsCount}\n行数：${lines}`
    }
  }
]

/** id → 转换器 */
export const TRANSFORM_MAP = TRANSFORMS.reduce((acc, item) => {
  acc[item.id] = item
  return acc
}, {})

/** 按 group 聚合后的分组列表，供编辑器下拉框使用 */
export const TRANSFORM_GROUPS = TRANSFORMS.reduce((acc, item) => {
  const group = acc.find((entry) => entry.name === item.group)
  if (group) {
    group.items.push(item)
  } else {
    acc.push({ name: item.group, items: [item] })
  }
  return acc
}, [])

/**
 * 执行一个转换。
 * @returns {string} 转换结果
 * @throws 转换器自身抛出的错误（如 JSON 解析失败）
 */
export function applyTransform(id, text) {
  const transform = TRANSFORM_MAP[id]
  if (!transform) {
    throw new Error(`未知的文本转换：${id}`)
  }
  return transform.apply(text)
}

/** 转换器 id → 名称，找不到时回退到 id */
export function transformName(id) {
  const transform = TRANSFORM_MAP[id]
  return transform ? transform.name : id
}
