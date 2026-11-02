/**
 * 搜索框推送结果索引
 *
 * utools.onMainPush 的 onSelect 回调只能拿到被选中结果的 text，
 * 用一张快照表把 text 映射回命令 id，同时记住当时的搜索词，
 * 这样「输入关键字 → 命中命令 → 直接把关键字作为输入执行」才能成立。
 */

const index = new Map()

/** 索引上限：用户连续输入时旧条目会被挤掉，避免无限增长 */
const MAX_ENTRIES = 50

/** 记录一条推送结果 */
export function recordPush(text, commandId, keyword) {
  index.set(text, { commandId, keyword: keyword || '' })
  while (index.size > MAX_ENTRIES) {
    const oldest = index.keys().next().value
    index.delete(oldest)
  }
}

/** 取出一条推送结果并移除 */
export function takePush(text) {
  const entry = index.get(text)
  if (entry) index.delete(text)
  return entry || null
}

/** 清空索引 */
export function clearPushIndex() {
  index.clear()
}
