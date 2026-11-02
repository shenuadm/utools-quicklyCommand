/**
 * 模糊匹配
 *
 * 用于命令面板与列表搜索：把 query 当作 target 的子序列来匹配，
 * 连续命中、词首命中得分更高。
 */

function toText(value) {
  return value === undefined || value === null ? '' : String(value)
}

/**
 * @param {string} query 查询词
 * @param {string} target 目标文本
 * @returns {{score: number, indices: number[]}|null} 不匹配时返回 null
 */
export function fuzzyMatch(query, target) {
  const q = toText(query).trim().toLowerCase()
  const t = toText(target)
  if (!q) return { score: 0, indices: [] }
  if (!t) return null

  const lowerTarget = t.toLowerCase()
  const indices = []
  let score = 0
  let targetIndex = 0
  let previousIndex = -2

  for (let i = 0; i < q.length; i++) {
    const char = q[i]
    const found = lowerTarget.indexOf(char, targetIndex)
    if (found === -1) return null

    indices.push(found)

    // 连续命中加分
    if (found === previousIndex + 1) score += 8
    // 词首命中加分
    if (found === 0 || /[\s\-_/·.、,]/.test(t[found - 1] || '')) score += 6
    score += 1

    previousIndex = found
    targetIndex = found + 1
  }

  // 越短的目标越匹配
  score += Math.max(0, 20 - (t.length - q.length) * 0.2)
  // 完全相等的排在最前
  if (lowerTarget === q) score += 100
  else if (lowerTarget.startsWith(q)) score += 40
  else if (lowerTarget.includes(q)) score += 20

  return { score, indices }
}

/**
 * 在列表中按关键字过滤并排序。
 * @param {Array<{name?: string, description?: string, tags?: string[]}>} items
 * @param {string} query
 * @param {string[]} extraFields 额外参与匹配的字段名
 */
export function fuzzyFilter(items, query, extraFields = ['description']) {
  const q = toText(query).trim()
  if (!q) return items.slice()

  const scored = []
  for (const item of items) {
    const fields = ['name', ...extraFields]
    let best = null
    for (const field of fields) {
      const value = field === 'tags' ? (item.tags || []).join(' ') : item[field]
      const matched = fuzzyMatch(q, value)
      if (matched && (!best || matched.score > best.score)) {
        best = { score: matched.score, field }
      }
    }
    if (best) {
      scored.push({ item, score: best.score })
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item)
}
