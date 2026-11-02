/**
 * 核心逻辑冒烟测试
 *
 * 直接跑 src/core 下的纯逻辑模块，覆盖模板渲染、文本转换、模糊匹配与
 * 动作分发。不依赖 uTools 运行时（env.js 在 Node 下会自动走 mock 分支）。
 *
 * 运行：node scripts/smoke.mjs
 */

import assert from 'node:assert/strict'

import {
  renderTemplate,
  validateCmdName,
  actionUsesText,
  actionBody,
  commandBody,
  ACTION_TYPES,
  defaultActionOf
} from '../src/core/actions.js'
import { applyTransform, utf8ToBase64, base64ToUtf8 } from '../src/core/transforms.js'
import { fuzzyMatch, fuzzyFilter } from '../src/core/fuzzy.js'
import { engineTemplate } from '../src/core/engines.js'
import { runCommand } from '../src/core/runner.js'
import { syncDynamicFeatures, buildCmds, featureCodeOf } from '../src/api/dynamic-features.js'
import { mergeImport, buildExportPayload } from '../src/api/io.js'
import { listCommands, saveCommand, clearAll } from '../src/api/db.js'
import { seedIfFirstRun, seedDefaults } from '../src/api/seed.js'
import { utools } from '../src/api/env.js'

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failed += 1
    console.error(`  ✗ ${name}\n    ${err.message}`)
  }
}

async function testAsync(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failed += 1
    console.error(`  ✗ ${name}\n    ${err.message}`)
  }
}

console.log('\n模板渲染')
test('替换 {{text}}', () => {
  assert.equal(renderTemplate('搜索 {{text}}', { text: 'vue' }), '搜索 vue')
})
test('URL 场景下默认编码', () => {
  assert.equal(
    renderTemplate('https://x.com?q={{text}}', { text: 'a b&c' }, { urlEncode: true }),
    'https://x.com?q=a%20b%26c'
  )
})
test('|raw 过滤器跳过编码', () => {
  assert.equal(
    renderTemplate('{{text|raw}}', { text: 'a b' }, { urlEncode: true }),
    'a b'
  )
})
test('|urlencode 过滤器', () => {
  assert.equal(renderTemplate('{{text|urlencode}}', { text: 'a b' }), 'a%20b')
})
test('|trim / |upper / |lower 过滤器', () => {
  assert.equal(renderTemplate('{{text|trim}}', { text: '  a  ' }), 'a')
  assert.equal(renderTemplate('{{text|upper}}', { text: 'ab' }), 'AB')
  assert.equal(renderTemplate('{{text|lower}}', { text: 'AB' }), 'ab')
})
test('|base64 过滤器', () => {
  assert.equal(renderTemplate('{{text|base64}}', { text: 'hello' }), 'aGVsbG8=')
})
test('未定义的变量替换为空串', () => {
  assert.equal(renderTemplate('[{{missing}}]', {}), '[]')
})

console.log('\n指令名校验')
test('合法名称通过', () => {
  assert.equal(validateCmdName('百度搜索').ok, true)
})
test('空名称不通过', () => {
  assert.equal(validateCmdName('   ').ok, false)
})
test('系统保留字符不通过', () => {
  assert.equal(validateCmdName('a/b').ok, false)
  assert.equal(validateCmdName('a:b').ok, false)
  assert.equal(validateCmdName('a?b').ok, false)
})
test('控制字符不通过', () => {
  assert.equal(validateCmdName('a\u0001b').ok, false)
})
test('纯 Emoji 不通过', () => {
  assert.equal(validateCmdName('⚡🔥').ok, false)
})
test('超长名称不通过', () => {
  assert.equal(validateCmdName('x'.repeat(81)).ok, false)
})

console.log('\n文本转换')
test('upper / lower', () => {
  assert.equal(applyTransform('upper', 'aBc'), 'ABC')
  assert.equal(applyTransform('lower', 'aBc'), 'abc')
})
test('trim / noSpace', () => {
  assert.equal(applyTransform('trim', '  a  '), 'a')
  assert.equal(applyTransform('noSpace', ' a b\tc '), 'abc')
})
test('camel / kebab / snake', () => {
  assert.equal(applyTransform('camel', 'hello world'), 'helloWorld')
  assert.equal(applyTransform('kebab', 'Hello World'), 'hello-world')
  assert.equal(applyTransform('snake', 'Hello World'), 'hello_world')
})
test('Base64 往返（UTF-8 安全）', () => {
  const source = '中文 & emoji 🚀'
  assert.equal(base64ToUtf8(utf8ToBase64(source)), source)
})
test('URL 编解码往返', () => {
  assert.equal(applyTransform('urlDecode', applyTransform('urlEncode', 'a b&c')), 'a b&c')
})
test('JSON 格式化 / 压缩往返', () => {
  const source = '{"a":1,"b":[2,3]}'
  assert.equal(applyTransform('jsonMinify', applyTransform('jsonFormat', source)), source)
})
test('JSON 格式化对非法输入抛错', () => {
  assert.throws(() => applyTransform('jsonFormat', 'not json'))
})
test('提取邮箱与链接', () => {
  assert.equal(
    applyTransform('extractEmails', '联系 a@b.com 或 c@d.cn'),
    'a@b.com\nc@d.cn'
  )
  assert.equal(
    applyTransform('extractUrls', '见 https://a.com 和 http://b.cn/x'),
    'https://a.com\nhttp://b.cn/x'
  )
})
test('千分位', () => {
  assert.equal(applyTransform('numberFormat', '1234567.89'), '1,234,567.89')
})
test('去重行', () => {
  assert.equal(applyTransform('dedupeLines', 'a\nb\na'), 'a\nb')
})
test('反转文本按码点处理', () => {
  assert.equal(applyTransform('reverse', 'ab'), 'ba')
})
test('未知转换抛错', () => {
  assert.throws(() => applyTransform('nope', 'x'))
})

console.log('\n模糊匹配')
test('完全匹配得分最高', () => {
  const exact = fuzzyMatch('baidu', 'baidu')
  const partial = fuzzyMatch('baidu', 'baidu search')
  assert.ok(exact.score > partial.score)
})
test('子序列可以匹配', () => {
  assert.ok(fuzzyMatch('bds', 'baidu search') !== null)
})
test('不匹配返回 null', () => {
  assert.equal(fuzzyMatch('zzz', 'baidu'), null)
})
test('fuzzyFilter 按相关度排序', () => {
  const items = [
    { name: '百度搜索' },
    { name: 'GitHub 搜索' },
    { name: '打开项目主页' }
  ]
  const result = fuzzyFilter(items, '百度')
  assert.equal(result[0].name, '百度搜索')
})

console.log('\n动作元数据')
test('8 种动作都有默认值', () => {
  assert.equal(ACTION_TYPES.length, 8)
  for (const type of ACTION_TYPES) {
    assert.ok(type.id && type.name && type.icon)
    assert.equal(defaultActionOf(type.id).type, type.id)
  }
})
test('search / transform 判定为消费文本', () => {
  assert.equal(actionUsesText({ type: 'search', engine: 'google' }), true)
  assert.equal(actionUsesText({ type: 'transform', transform: 'upper' }), true)
})
test('openPath 不消费文本', () => {
  assert.equal(actionUsesText({ type: 'openPath', path: '/tmp' }), false)
})
test('openUrl 依据模板判定', () => {
  assert.equal(actionUsesText({ type: 'openUrl', url: 'https://x.com' }), false)
  assert.equal(actionUsesText({ type: 'openUrl', url: 'https://x.com?q={{text}}' }), true)
})
test('搜索引擎模板渲染', () => {
  const url = renderTemplate(engineTemplate('baidu'), { text: 'vue' }, { urlEncode: true })
  assert.equal(url, 'https://www.baidu.com/s?wd=vue')
})

console.log('\n命令执行内容（双击复制）')
test('openUrl 返回原始 URL 模板', () => {
  assert.equal(
    actionBody({ type: 'openUrl', url: 'https://x.com/q={{text}}' }),
    'https://x.com/q={{text}}'
  )
})
test('search 返回搜索引擎模板', () => {
  assert.equal(
    actionBody({ type: 'search', engine: 'baidu' }),
    'https://www.baidu.com/s?wd={{text}}'
  )
})
test('search 自定义模板返回自定义 URL', () => {
  assert.equal(
    actionBody({ type: 'search', engine: 'custom', urlTemplate: 'https://s.io?q={{text}}' }),
    'https://s.io?q={{text}}'
  )
})
test('transform 返回转换 id', () => {
  assert.equal(actionBody({ type: 'transform', transform: 'upper' }), 'upper')
})
test('shell 返回命令行', () => {
  assert.equal(actionBody({ type: 'shell', command: 'echo {{text}}' }), 'echo {{text}}')
})
test('script 返回脚本代码', () => {
  assert.equal(
    actionBody({ type: 'script', code: 'return text.toUpperCase()' }),
    'return text.toUpperCase()'
  )
})
test('openPath 返回路径', () => {
  assert.equal(actionBody({ type: 'openPath', path: 'C:\\notes.md' }), 'C:\\notes.md')
})
test('copy 返回待复制内容', () => {
  assert.equal(actionBody({ type: 'copy', text: '{{text}}' }), '{{text}}')
})
test('redirect 返回目标指令名', () => {
  assert.equal(actionBody({ type: 'redirect', target: '翻译' }), '翻译')
})
test('未知动作返回空串', () => {
  assert.equal(actionBody({ type: 'nope' }), '')
  assert.equal(actionBody(null), '')
})
test('commandBody 取命令的动作内容', () => {
  assert.equal(
    commandBody({ name: 'x', action: { type: 'shell', command: 'ls -la' } }),
    'ls -la'
  )
  assert.equal(commandBody(null), '')
})

console.log('\n动作分发')
await testAsync('transform 走转换器', async () => {
  const command = {
    id: 'c1',
    name: '大写',
    category: '文本',
    action: { type: 'transform', transform: 'upper' },
    options: { notify: false }
  }
  const result = await runCommand(command, { text: 'abc' })
  assert.equal(result.ok, true)
  assert.equal(result.output, 'ABC')
})
await testAsync('copy 写入剪贴板', async () => {
  const command = {
    id: 'c2',
    name: '复制',
    category: '文本',
    action: { type: 'copy', text: '固定内容' },
    options: { notify: false }
  }
  const result = await runCommand(command, { text: 'x' })
  assert.equal(result.ok, true)
  assert.equal(result.output, '固定内容')
})
await testAsync('未知动作类型返回失败', async () => {
  const command = {
    id: 'c3',
    name: '坏动作',
    category: '测试',
    action: { type: 'nope' },
    options: { notify: false }
  }
  const result = await runCommand(command, {})
  assert.equal(result.ok, false)
  assert.match(result.message, /未知的动作类型/)
})
await testAsync('执行后统计次数', async () => {
  const command = {
    id: 'c4',
    name: '统计',
    category: '测试',
    action: { type: 'transform', transform: 'upper' },
    options: { notify: false }
  }
  const result = await runCommand(command, { text: 'x' })
  assert.ok(result.command)
  assert.equal(result.command.runCount, 1)
})

console.log('\n动态功能对账')
test('动态功能 code 与 plugin.json 的 feature code 隔离', () => {
  assert.equal(featureCodeOf('abc').startsWith('qc-run-'), true)
  assert.equal(featureCodeOf('abc') === 'qc-manager', false)
})
test('消费文本的命令挂匹配指令，不消费的只挂功能指令', () => {
  const withText = buildCmds({ name: '搜索', action: { type: 'search', engine: 'baidu' } })
  assert.equal(withText.length, 2)
  assert.equal(withText[0], '搜索')
  assert.equal(withText[1].type, 'over')

  const withoutText = buildCmds({ name: '打开', action: { type: 'openPath', path: '/tmp' } })
  assert.equal(withoutText.length, 1)
})
test('启用的命令被注册，禁用的不注册', () => {
  clearAll()
  const enabled = saveCommand({
    name: '启用项',
    action: { type: 'transform', transform: 'upper' },
    enabled: true
  })
  const disabled = saveCommand({
    name: '禁用项',
    action: { type: 'transform', transform: 'upper' },
    enabled: false
  })

  syncDynamicFeatures([enabled, disabled], { register: true })
  let features = utools.getFeatures()
  assert.equal(features.length, 1)
  assert.equal(features[0].code, featureCodeOf(enabled.id))

  // 关闭注册开关后应清空
  syncDynamicFeatures([enabled, disabled], { register: false })
  features = utools.getFeatures()
  assert.equal(features.length, 0)
})

console.log('\n导入导出')
test('导出内容包含命令与分类', () => {
  clearAll()
  saveCommand({ name: '导出项', action: { type: 'transform', transform: 'upper' } })
  const payload = buildExportPayload(listCommands(), [])
  assert.equal(payload.version, 1)
  assert.equal(payload.commands.length, 1)
  assert.equal(payload.commands[0].name, '导出项')
})
test('overwrite 策略按名称更新已有命令', () => {
  clearAll()
  saveCommand({ name: '同名', action: { type: 'transform', transform: 'upper' } })
  const before = listCommands().length

  const result = mergeImport(
    {
      version: 1,
      commands: [{ name: '同名', action: { type: 'transform', transform: 'lower' } }]
    },
    'overwrite'
  )
  assert.equal(result.ok, true)
  assert.equal(result.updated, 1)
  assert.equal(result.added, 0)
  assert.equal(listCommands().length, before)
  assert.equal(listCommands()[0].action.transform, 'lower')
})
test('skip 策略跳过同名命令', () => {
  clearAll()
  saveCommand({ name: '同名', action: { type: 'transform', transform: 'upper' } })
  const before = listCommands().length

  const result = mergeImport(
    {
      version: 1,
      commands: [{ name: '同名', action: { type: 'transform', transform: 'lower' } }]
    },
    'skip'
  )
  assert.equal(result.skipped, 1)
  assert.equal(listCommands().length, before)
  assert.equal(listCommands()[0].action.transform, 'upper')
})
test('rename 策略生成新名字', () => {
  clearAll()
  saveCommand({ name: '同名', action: { type: 'transform', transform: 'upper' } })

  const result = mergeImport(
    {
      version: 1,
      commands: [{ name: '同名', action: { type: 'transform', transform: 'lower' } }]
    },
    'rename'
  )
  assert.equal(result.added, 1)
  const names = listCommands().map((command) => command.name)
  assert.equal(names.length, 2)
  assert.ok(names.includes('同名 (导入)'))
})
test('导入内容缺少 commands 数组时报错', () => {
  const result = mergeImport({ version: 1 }, 'overwrite')
  assert.equal(result.ok, false)
})

console.log('\n示例命令与初始化')
test('新建文档不会带上 _rev 键', () => {
  clearAll()
  const saved = saveCommand({ name: '无 rev 测试', action: { type: 'transform', transform: 'upper' } })
  assert.ok(saved.id)
  assert.ok(listCommands().some((command) => command.name === '无 rev 测试'))
})
test('更新已有文档会带上正确的 _rev', () => {
  clearAll()
  const first = saveCommand({ name: '更新测试', action: { type: 'transform', transform: 'upper' } })
  const second = saveCommand({ ...first, description: '改过了' })
  assert.ok(second._rev, '更新后应当有新的版本号')
  assert.notEqual(second._rev, first._rev)
  const stored = listCommands().find((command) => command.name === '更新测试')
  assert.equal(stored.description, '改过了')
})
test('首次运行会写入示例命令', () => {
  clearAll()
  utools.dbStorage.removeItem('qc.seeded')
  const result = seedIfFirstRun()
  assert.ok(result.added > 0, `实际写入 ${result.added} 条`)
  assert.equal(result.errors.length, 0)
  assert.ok(listCommands().length > 0)
})
test('写入失败时不标记「已初始化」，以便下次重试', () => {
  clearAll()
  utools.dbStorage.removeItem('qc.seeded')
  const originalPut = utools.db.put
  utools.db.put = () => ({ id: 'x', ok: false, message: '模拟写入失败' })
  try {
    const result = seedIfFirstRun()
    assert.equal(result.added, 0)
    assert.ok(result.errors.length > 0, '应当收集到错误信息')
    assert.equal(
      utools.dbStorage.getItem('qc.seeded'),
      null,
      '写入失败时不能置位已初始化标记'
    )
  } finally {
    utools.db.put = originalPut
  }
})
test('数据库为空时即使标记过也会重新写入（自愈）', () => {
  clearAll()
  utools.dbStorage.setItem('qc.seeded', true)
  const result = seedIfFirstRun()
  assert.ok(result.added > 0, '空库应当重新写入示例命令')
  assert.ok(listCommands().length > 0)
})
test('数据库已有命令时不会重复写入', () => {
  clearAll()
  seedDefaults()
  const before = listCommands().length
  const result = seedIfFirstRun()
  assert.equal(result.added, 0)
  assert.equal(listCommands().length, before)
})
test('seedDefaults 会返回错误清单而不是静默吞掉', () => {
  clearAll()
  const originalPut = utools.db.put
  utools.db.put = () => ({ id: 'x', ok: false, message: '模拟写入失败' })
  try {
    const result = seedDefaults()
    assert.equal(result.added, 0)
    assert.ok(result.errors.length > 0)
  } finally {
    utools.db.put = originalPut
  }
})

console.log(`\n${passed} 项通过，${failed} 项失败\n`)
process.exit(failed ? 1 : 0)
