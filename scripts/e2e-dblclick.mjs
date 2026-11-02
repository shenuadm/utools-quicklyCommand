/**
 * 双击复制的端到端检查
 *
 * 用无头 Chrome 真实派发 dblclick 事件，确认：
 *   1. 复制到剪贴板的是命令的执行内容（模板原样）；
 *   2. 双击不会顺带把命令执行一遍。
 *
 * 用法：node scripts/e2e-dblclick.mjs [页面地址]
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const url = process.argv[2] || 'http://127.0.0.1:5173/'
const PORT = 9334

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
]

const chrome = CHROME_CANDIDATES.find((candidate) => existsSync(candidate))
if (!chrome) {
  console.error('未找到 Chrome，跳过端到端检查')
  process.exit(0)
}

const profileDir = path.join(process.env.TEMP || '.', 'qc-e2e-profile')

const chromeProcess = spawn(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profileDir}`,
    '--window-size=1100,680',
    'about:blank'
  ],
  { stdio: 'ignore' }
)

async function waitForTarget() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`)
      const list = await res.json()
      const page = list.find((target) => target.type === 'page')
      if (page) return page
    } catch (err) {
      /* 还没起来 */
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('Chrome 调试端口未就绪')
}

const target = await waitForTarget()
const socket = new WebSocket(target.webSocketDebuggerUrl)
let messageId = 0
const pending = new Map()
const consoleLines = []

socket.addEventListener('message', (event) => {
  const payload = JSON.parse(event.data)
  if (payload.method === 'Runtime.consoleAPICalled') {
    const text = (payload.params.args || [])
      .map((arg) => (arg.value !== undefined ? arg.value : arg.description || ''))
      .join(' ')
    consoleLines.push(text)
  }
  if (payload.id && pending.has(payload.id)) {
    const { resolve, reject } = pending.get(payload.id)
    pending.delete(payload.id)
    if (payload.error) reject(new Error(payload.error.message))
    else resolve(payload.result)
  }
})

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

function send(method, params = {}) {
  const id = ++messageId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url })
await wait(2000)

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  })
  return result.result && result.result.value
}

/** 派发真实的双击（detail=2） */
async function doubleClick(selector) {
  return evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return 'NOT_FOUND';
    const box = el.getBoundingClientRect();
    const opts = { bubbles: true, cancelable: true, clientX: box.left + 10, clientY: box.top + 10, detail: 2 };
    el.dispatchEvent(new MouseEvent('dblclick', opts));
    return 'OK';
  })()`)
}

async function singleClick(selector) {
  return evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return 'NOT_FOUND';
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    return 'OK';
  })()`)
}

/** 按命令名找到卡片里的某个元素（:text-is() 不是标准选择器，这里用遍历） */
async function clickCardIconByName(commandName, eventName = 'click') {
  return evaluate(`(() => {
    const cards = Array.from(document.querySelectorAll('.card'));
    const card = cards.find((item) => {
      const name = item.querySelector('.name');
      return name && name.textContent.trim() === ${JSON.stringify(commandName)};
    });
    if (!card) return 'NOT_FOUND';
    const icon = card.querySelector('.icon-btn');
    if (!icon) return 'NOT_FOUND';
    icon.dispatchEvent(new MouseEvent(${JSON.stringify(eventName)}, {
      bubbles: true, cancelable: true, detail: ${eventName === 'dblclick' ? 2 : 1}
    }));
    return 'OK';
  })()`)
}

/** 确认框是否弹出；弹出则点掉「确定」 */
async function confirmDialogIfOpen() {
  const state = await evaluate(`(() => {
    const dialog = document.querySelector('.dialog');
    if (!dialog) return 'NONE';
    const buttons = Array.from(dialog.querySelectorAll('.dialog-actions .btn'));
    const confirm = buttons[buttons.length - 1];
    if (confirm) confirm.click();
    return 'CONFIRMED';
  })()`)
  return state
}

let failed = 0
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  ✓ ${name}`)
  } else {
    failed += 1
    console.error(`  ✗ ${name}${detail ? `\n    ${detail}` : ''}`)
  }
}

/** 是否发生了任何一次「执行」 */
function didExecute() {
  return consoleLines.some(
    (line) =>
      line.startsWith('[mock] shellOpenExternal') ||
      line.startsWith('[mock] runScript') ||
      line.startsWith('[mock] shellOpenPath')
  )
}

console.log('\n双击复制')

// 取第一条命令的预期执行内容
const expected = await evaluate(`(() => {
  const rows = Array.from(document.querySelectorAll('.card'));
  if (!rows.length) return null;
  const name = rows[0].querySelector('.name').textContent.trim();
  return { name };
})()`)

if (!expected) {
  console.error('列表里没有命令，无法检查')
  socket.close()
  chromeProcess.kill()
  process.exit(1)
}

consoleLines.length = 0
const dbl = await doubleClick('.card .name')
check('双击命令名有响应', dbl === 'OK', dbl)
await wait(400)

const copied = consoleLines.find((line) => line.startsWith('[mock] copyText '))
check('双击把命令内容复制到剪贴板', !!copied, `控制台输出：${consoleLines.join(' | ')}`)

if (copied) {
  const value = copied.slice('[mock] copyText '.length)
  check(
    '复制的是命令的执行内容而不是名字',
    value !== expected.name && value.length > 0,
    `复制到：${value}`
  )
  check('复制内容保留了模板变量', value.includes('{{text}}') || value.includes('http'), `复制到：${value}`)
}

check('双击没有顺带执行命令', !didExecute(), consoleLines.join(' | '))

console.log('\n双击图标')
// 双击图标同样应该是「复制」，而不是「执行」
consoleLines.length = 0
const dblIcon = await clickCardIconByName('复制当前时间', 'dblclick')
check('双击图标有响应', dblIcon === 'OK', dblIcon)
await wait(500)
check(
  '双击图标也复制而不是执行',
  consoleLines.some((line) => line.startsWith('[mock] copyText ')),
  consoleLines.join(' | ')
)
check('双击图标没有触发执行', !didExecute(), consoleLines.join(' | '))

console.log('\n单击执行')
// 用一条不需要输入文本的命令（执行 JS 脚本），避免弹出输入框
consoleLines.length = 0
const single = await clickCardIconByName('复制当前时间')
check('单击图标有响应', single === 'OK', single)
await wait(500)
// 执行本地脚本前会弹确认框，这是预期行为
const dialog = await confirmDialogIfOpen()
check('执行前弹出确认框', dialog === 'CONFIRMED', `对话框状态：${dialog}`)
await wait(400)
check('确认后命令被执行', didExecute(), consoleLines.join(' | '))

console.log(`\n${failed ? `${failed} 项失败` : '全部通过'}\n`)

socket.close()
chromeProcess.kill()
process.exit(failed ? 1 : 0)
