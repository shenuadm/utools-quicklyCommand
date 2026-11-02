/**
 * 开发期界面截图工具
 *
 * 通过 Chrome DevTools Protocol 驱动无头浏览器，逐个进入插件的各个视图并截图，
 * 用来在不开 uTools 的情况下检查界面渲染效果。
 *
 * 用法：
 *   node scripts/shoot.mjs http://127.0.0.1:5173/ /输出目录
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const url = process.argv[2] || 'http://127.0.0.1:5173/'
const outDir = process.argv[3] || path.resolve('screenshots')
const PORT = 9333

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
]

function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

const chrome = findChrome()
if (!chrome) {
  console.error('未找到 Chrome，可跳过截图步骤')
  process.exit(0)
}

mkdirSync(outDir, { recursive: true })

const chromeProcess = spawn(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=' + path.join(outDir, '.chrome-profile'),
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

socket.addEventListener('message', (event) => {
  const payload = JSON.parse(event.data)
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

// 收集控制台错误
const consoleErrors = []
socket.addEventListener('message', (event) => {
  const payload = JSON.parse(event.data)
  if (payload.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(payload.params.exceptionDetails?.text || 'unknown error')
  }
})

async function shoot(name, steps) {
  const list = Array.isArray(steps) ? steps : [steps]
  for (const step of list) {
    await send('Runtime.evaluate', { expression: step, awaitPromise: true })
    await wait(450)
  }
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  const file = path.join(outDir, `${name}.png`)
  writeFileSync(file, Buffer.from(data, 'base64'))
  console.log(`已保存 ${file}`)
}

await send('Page.navigate', { url })
await wait(1800)

const ENTER_MANAGER = 'window.mockEnter && window.mockEnter("qc-manager", "text", "")'

/** 点击侧边栏里文本匹配的第一个导航项 */
function clickNav(label) {
  return `(() => {
    const items = Array.from(document.querySelectorAll('.nav-item'));
    const target = items.find((item) => item.textContent.trim().startsWith(${JSON.stringify(label)}));
    if (target) { target.click(); return true; }
    return false;
  })()`
}

await shoot('01-manager', ENTER_MANAGER)
await shoot('02-launcher', 'window.mockEnter && window.mockEnter("qc-launcher", "text", "")')
await shoot(
  '03-text-picker',
  'window.mockEnter && window.mockEnter("qc-text", "over", "uTools 是一个效率工具，支持插件扩展与超级面板。")'
)
await shoot('04-stats', [ENTER_MANAGER, clickNav('统计')])
await shoot('05-categories', [ENTER_MANAGER, clickNav('分类')])
await shoot('06-settings', [ENTER_MANAGER, clickNav('设置')])
await shoot('07-editor', [
  ENTER_MANAGER,
  `(() => {
    const button = Array.from(document.querySelectorAll('button'))
      .find((item) => item.textContent.includes('新建快命令'));
    if (button) { button.click(); return true; }
    return false;
  })()`
])

// 浅色主题复核：主题跟随系统，这里模拟 prefers-color-scheme: light
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-color-scheme', value: 'light' }]
})
await wait(300)
// 先关掉编辑抽屉并回到命令列表
await shoot('08-manager-light', [
  ENTER_MANAGER,
  clickNav('命令列表'),
  `(() => {
    const close = document.querySelector('.drawer .head .btn-icon');
    if (close) { close.click(); return true; }
    return false;
  })()`
])
await shoot('09-stats-light', [ENTER_MANAGER, clickNav('统计')])

// 悬停提示（双击复制的可发现性）
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-color-scheme', value: 'dark' }]
})
await wait(200)
await shoot('10-hover-hint', [ENTER_MANAGER, clickNav('命令列表')])
const box = await send('Runtime.evaluate', {
  expression: `(() => {
    const card = document.querySelectorAll('.card')[1];
    if (!card) return null;
    const r = card.getBoundingClientRect();
    return { x: r.left + 200, y: r.top + r.height / 2 };
  })()`,
  returnByValue: true
})
if (box.result && box.result.value) {
  const { x, y } = box.result.value
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
  await wait(400)
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  const file = path.join(outDir, '11-hover-hint.png')
  writeFileSync(file, Buffer.from(data, 'base64'))
  console.log(`已保存 ${file}`)
}

if (consoleErrors.length) {
  console.error('\n页面抛出异常：')
  consoleErrors.forEach((err) => console.error(`  - ${err}`))
} else {
  console.log('\n页面没有抛出异常')
}

socket.close()
chromeProcess.kill()
process.exit(0)
