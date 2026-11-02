# 快命令管理 · QuicklyCommand

一个 uTools 插件：把常用的网址、搜索、文本处理、本地命令等固化成「快命令」，
用分类和标签组织起来，并且**直接注册进 uTools 搜索框与超级面板**——
不用先打开插件，输个名字就能直接执行。

> 基于 [uTools 插件应用架构](https://www.u-tools.cn/docs/development/plugin-architecture.html) 与
> [plugin.json 配置说明](https://www.u-tools.cn/docs/development/plugin-json.html) 实现。

---

## 功能一览

### 8 种动作类型

| 动作 | 说明 | 模板变量 |
| --- | --- | --- |
| 🌐 打开网址 | 用默认浏览器打开，支持自定义 URL | `{{text}}` `{{selection}}` `{{clipboard}}` |
| 🔍 搜索引擎 | Google / Bing / 百度 / 搜狗 / 360 / DuckDuckGo / GitHub / 知乎 / B 站 / YouTube / 淘宝 / npm / MDN，也可自定义 | `{{text}}` |
| 🔤 文本处理 | 30+ 种转换：大小写、驼峰、Base64、URL 编解码、JSON 格式化、提取邮箱/链接、千分位、字数统计…… | `{{text}}` |
| ⚙️ 执行本地命令 | 在系统 Shell 中执行一条命令 | `{{text}}` |
| 📜 执行 JS 脚本 | 在 `node:vm` 沙箱中执行一段 JavaScript，可 `return` 结果 | `{{text}}` `{{selection}}` `{{clipboard}}` |
| 📂 打开文件或目录 | 用系统默认程序打开，或在文件管理器中定位 | `{{text}}` |
| 📋 复制到剪贴板 | 把指定内容写入剪贴板 | `{{text}}` |
| 🔗 跳转到其他插件 | 调用 `utools.redirect` 跳到另一个插件的功能指令 | `{{text}}` |

模板变量支持过滤器：`{{text}}` `{{text|raw}}` `{{text|urlencode}}` `{{text|trim}}`
`{{text|base64}}` `{{text|upper}}` `{{text|lower}}`。URL 类动作中 `{{text}}` 默认做 URL 编码，
需要原样拼接时加 `|raw`。

### 其它能力

- **双击复制命令内容**：在命令列表里**双击任意一条命令**，把它的「执行内容」复制到剪贴板 ——
  URL 模板、Shell 命令行、脚本代码、转换 id 等，模板变量保持 `{{text}}` 原样，
  可以直接粘到终端、配置文件或聊天窗口里使用。悬停时行尾会出现「双击复制命令内容」提示，
  右侧也有一个复制按钮。
- **动态功能注册**：每条启用的快命令都会通过 `utools.setFeature` 注册成 uTools 动态功能，
  在 uTools 搜索框里直接输入命令名即可执行；只有真正消费文本的命令才会额外挂上文本匹配指令，
  避免超级面板被无意义的入口淹没。
- **超级面板工作流**：选中任意文字 → 超级面板出现「快命令处理文本」→ 挑一条命令处理它。
- **命令面板**：模糊搜索全部命令，`↑↓` 选择、`Enter` 执行。
- **分类 / 标签 / 收藏**：侧边栏按分类筛选，标签横向过滤，收藏置顶。
- **使用统计**：每日执行次数（近 14 天）、高频命令排行、动作类型分布、最近执行记录。
- **导入 / 导出 JSON**：备份与迁移，导入时可选「覆盖 / 跳过 / 重命名」三种冲突策略。
- **AI 工具**：通过 `utools.registerTool` 暴露 `list_quick_commands` 与 `run_quick_command`
  两个工具，uTools 开启 MCP 服务后，Claude Code / Codex 等 AI Agent 可以直接调用。
- **全局快捷键**：为任意命令绑定 uTools 全局快捷键。
- **主题**：跟随系统 / 浅色 / 深色。

---

## 目录结构

```
QuicklyCommand/
├─ public/                 # 插件应用固定资源（Vite 会原样拷贝到 dist/）
│  ├─ plugin.json          # 插件配置：4 个 feature + 2 个 AI tool 声明
│  ├─ preload.js           # preload 桥接层（CommonJS），暴露 window.services
│  └─ logo.png
├─ src/
│  ├─ main.js              # 入口：注册 AI tools、绑定 onPluginReady、挂载 Vue
│  ├─ App.vue              # 按 onPluginEnter 的 action.code 路由到各视图
│  ├─ core/                # 纯逻辑，不依赖 DOM / uTools，便于单测
│  │  ├─ actions.js        # 8 种动作的元数据、模板渲染、指令名校验
│  │  ├─ engines.js        # 内置搜索引擎
│  │  ├─ transforms.js     # 文本转换
│  │  ├─ fuzzy.js          # 模糊匹配
│  │  ├─ runner.js         # 执行引擎
│  │  └─ command-icon.js   # 图标取值
│  ├─ api/                 # 与 uTools 交互的层
│  │  ├─ env.js            # 运行环境适配（uTools / 浏览器 mock）
│  │  ├─ db.js             # 快命令与分类的 CRUD（utools.db）
│  │  ├─ settings.js       # 设置、动态功能快照、运行日志（utools.dbStorage）
│  │  ├─ dynamic-features.js # 命令 ↔ 动态功能对账
│  │  ├─ io.js             # 导入 / 导出
│  │  ├─ seed.js           # 示例命令
│  │  ├─ push-index.js     # 搜索框推送结果索引
│  │  └─ ai-tools.js       # registerTool 处理函数
│  ├─ stores/              # 响应式状态（reactive，不引 Pinia）
│  ├─ components/          # 通用组件
│  └─ views/               # 管理台 / 列表 / 编辑 / 分类 / 统计 / 设置 / 启动器 / 文本选择器
├─ scripts/
│  ├─ smoke.mjs            # 核心逻辑冒烟测试
│  └─ shoot.mjs            # 开发期界面截图（CDP 驱动无头 Chrome）
├─ index.html
├─ vite.config.mjs
└─ package.json
```

---

## 开发

```bash
npm install
npm run dev        # 开发服务器，固定在 http://127.0.0.1:5173
npm run test       # 核心逻辑冒烟测试（Node 直接跑 src/core）
npm run build      # 生产构建，产物在 dist/
npm run shoot      # 界面截图（需要本机装有 Chrome），用于不开 uTools 时检查各视图
```

### 装进 uTools

1. 安装 [uTools 开发者工具](https://www.u-tools.cn/docs/getting-started/create-plugin.html)。
2. 在开发者工具里「新建项目 → 新建 Vue+Vite 工程」，或直接把本仓库作为工程目录导入。
3. `npm install && npm run dev`，然后在开发者工具里点「安装（开发模式）」。

`public/plugin.json` 里的 `development.main` 指向 `http://127.0.0.1:5173`，
与 `vite.config.mjs` 中固定的端口一致，因此 uTools 会加载开发服务器上的代码，改动即时生效。

### 打包发布

```bash
npm run build
```

`dist/` 即为插件应用目录，可直接用开发者工具的「打包」功能发布。
构建时 Vite 会自动剥离 `plugin.json` 里的 `development` 字段，
避免发布后的插件仍然指向本地开发服务器。

---

## 数据存储

遵循 uTools 官方的[数据存储](https://www.u-tools.cn/docs/development/storage.html)建议分层：

| 数据 | 位置 | 原因 |
| --- | --- | --- |
| 快命令、分类 | `utools.db`（`_id` 前缀 `qc/command/`、`qc/category/`） | 结构化用户数据，参与 uTools 数据同步，可跨设备 |
| 偏好设置 | `utools.dbStorage`（`qc.settings`） | 小体量配置，同步 KV |
| 动态功能归属清单与快照 | `utools.dbStorage`（`qc.dynamicFeatureCodes`、`qc.dynamicFeatureSnapshot`） | 便于插件重装后清理残留功能 |
| 运行日志 | `utools.dbStorage`（`qc.runLog`，上限 1000 条） | 高频写入、放不下同步库的量级 |

---

## 安全说明

`执行本地命令` 与 `执行 JS 脚本` 两种动作会运行**你自己编写的内容**：

- Shell 命令通过 preload 的 `child_process.exec` 执行，默认超时 120 秒，输出上限 4MB。
- JS 脚本在 `node:vm` 沙箱中执行，默认超时 5 秒，沙箱只暴露 `text` / `selection` / `clipboard`
  与 `console`，脚本的返回值即结果。

> 需要说明的是：`node:vm` 提供的是**隔离与超时**，不是安全边界——它防的是脚本意外访问文件系统或
> 陷入死循环，而非蓄意逃逸。因为脚本内容本身就出自用户之手，这里的信任模型是「用户信任自己的代码」。
> 如果需要运行来源不明的脚本，请不要使用这两种动作类型。

默认设置里「执行本地命令前确认」是**开启**的，执行这类动作前会弹出确认框并显示将要运行的内容。
请只填写自己信任的命令或脚本。

preload 层遵循官方的「最小暴露」原则：统一挂在 `window.services` 命名空间下，
不把 `fs` / `child_process` / `vm` 等原始对象暴露给前端，每个入口都自行校验入参并捕获异常。

---

## AI 工具接入

插件在 `public/plugin.json` 的 `tools` 字段声明了两个工具：

- `list_quick_commands` —— 列出全部快命令，可按 `category` / `keyword` 过滤
- `run_quick_command` —— 按 `name` 执行一条快命令，可传 `text` 作为输入

在 uTools「设置 → AI 设置 → MCP 服务」里开启本地 MCP 服务后，
Claude Code、Codex 等支持 MCP 的 AI Agent 就能发现并调用这两个能力。

工具名必须与 `utools.registerTool()` 注册的名称完全一致，否则无法通过 MCP 暴露。

---

## 界面

| 视图 | 入口 | 说明 |
| --- | --- | --- |
| 管理台 | 「快命令管理」「快命令」 | 侧边栏 + 列表 + 编辑抽屉 + 统计 + 设置 |
| 命令面板 | 「快命令搜索」「命令面板」 | 模糊搜索并执行；也会在 uTools 搜索框实时推送匹配项 |
| 文本选择器 | 超级面板选中文字后的「快命令处理文本」 | 只列出会消费文本的命令 |
| 导入 / 导出 | 「导入快命令」「导出快命令」 | 直接在设置页的数据区执行 |

### 命令列表里的手势

| 手势 | 结果 |
| --- | --- |
| 单击左侧图标 | 执行这条命令（执行本地命令/脚本前会弹确认框） |
| 双击任意位置 | 复制这条命令的执行内容到剪贴板 |
| 单击右侧复制图标 | 同上 |
| 单击右侧铅笔 / 垃圾桶 / 星星 / 上下箭头 / 键盘 | 编辑 / 删除 / 收藏 / 排序 / 设置全局快捷键 |

---

## 排错

**列表里一条命令都没有？**

插件启动时会检查数据库：只要数据库是空的，就会自动写入一组示例命令 ——
即使之前某次初始化失败、留下了「已初始化」的标记，也会在下次启动时补写（自愈）。

如果还是空的，管理台顶部会出现一条红色的「数据读写出现问题」横幅，
里面写着具体是哪个命令、什么原因失败（比如「存储拒绝写入」），
横幅上有「重新载入」和「写入示例命令」两个按钮可以直接恢复。

把横幅里的错误文字反馈出来，就能定位到 uTools 侧的哪一步拒绝了写入。

---

## 许可

MIT
