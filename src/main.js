import { createApp } from 'vue'
import './main.css'
import App from './App.vue'
import { utools } from './api/env.js'
import { registerAiTools } from './api/ai-tools.js'
import { loadAll, syncFeatures, setInitError } from './stores/quickCommands.js'
import { seedIfFirstRun } from './api/seed.js'

/**
 * AI 工具必须在模块加载期注册。
 *
 * 官方文档说明：当 Tool 被调用时，若插件应用未运行，uTools 会启动插件应用并
 * 在初始化阶段执行 registerTool()，因此注册不能等到 Vue 挂载之后。
 */
registerAiTools()

/**
 * onPluginReady 会在插件应用加载完成后触发，uTools Runtime 会等待这里的
 * 异步回调完成后再让用户进入插件。
 *
 * 载入数据与写入示例命令分开处理：任何一步失败都不应该让用户看到一个空列表，
 * 出错时直接把原因显示在界面上。
 */
utools.onPluginReady(async () => {
  loadAll()

  try {
    const seeded = seedIfFirstRun()
    if (seeded.errors && seeded.errors.length) {
      setInitError(`示例命令写入失败：${seeded.errors.join('；')}`)
    }
    loadAll()
  } catch (err) {
    const message = err && err.message ? err.message : String(err)
    setInitError(`初始化失败：${message}`)
    console.error('[quickly-command] 初始化失败', err)
  }

  try {
    syncFeatures()
  } catch (err) {
    console.error('[quickly-command] 动态功能同步失败', err)
  }
})

createApp(App).mount('#app')
