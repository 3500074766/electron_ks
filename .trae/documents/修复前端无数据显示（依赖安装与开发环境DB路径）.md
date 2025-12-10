## 问题诊断
- 主进程报错：Cannot find module `axios`，导致 IPC 处理未注册，渲染进程拿不到任何事件。
- 用户数据为空：开发环境未能找到 `Sqlite3.db`，或未安装原生模块 `sqlite3`，导致 `users=[]` → 后续快手/ROI请求为空。
- 构建层面：`sqlite3` 需外部化，当前已在 `electron.vite.config.mjs` 外部化；但运行时仍要安装并正确定位 DB。

## 解决方案
1) 依赖安装（pnpm）：
- 启用 Corepack 并激活 pnpm，再执行安装：
  - `corepack enable`
  - `corepack prepare pnpm@latest --activate`
  - `pnpm install --no-frozen-lockfile`
- 如仍报 `axios` 缺失，单独安装：`pnpm add axios`（已在 `package.json` dependencies 中列出）。

2) 主进程 DB 路径修正（开发态）：
- 调整 `src/main/services/userService.js` 的 `resolveDbPath()` 逻辑，增加开发态回退：
  - 依次查找：
    - `process.resourcesPath/Sqlite3.db`（打包态）
    - `process.cwd()/Sqlite3.db`（在项目根放置）
    - `process.cwd()/../electron-ks/Sqlite3.db`（当前结构的兄弟目录）
    - `app.getPath('userData')/Sqlite3.db`（用户目录）
- 若仍找不到，向渲染进程推送 `error` 事件并提示“未检测到本地用户库”，前端显示空态而非静默不展示。

3) 原生模块安装与外部化：
- 保持 `electron.vite.config.mjs` 的 `main.build.rollupOptions.external=['sqlite3']`。
- 开发态安装 `sqlite3`：`pnpm add sqlite3`；若编译受限，临时允许空列表运行，待后续切换到 `better-sqlite3` 或提供 JSON 用户清单。

4) 首次连接与事件流：
- 保持 `registerIPC(mainWindow)` 在窗口创建后执行，并在连接时发送 `connection_established`。
- 在 `refresh_data` 之外，确保单独调用 `get_all_kuaishou_data`/`get_all_roi_data` 时，主进程已根据当前 `users` 推送相应事件（现有逻辑已实现）。

5) 验证步骤
- 执行依赖安装后，运行 `pnpm dev`。
- 打开 DevTools，确认：
  - 收到 `connection_established`；
  - 前端在连接后自动发起 `get_all_*`；
  - 主进程返回 `users_data`/`kuaishou_data`/`roi_data`，表格出现数据。
- 若用户库未找到，前端弹出消息并显示空表格，同时可通过导入或放置 `Sqlite3.db` 到上述路径之一解决。

## 代码改动（待应用）
- `src/main/services/userService.js`：增强 `resolveDbPath()` 的路径回退；读取失败时通过 `error` 事件告知渲染。
- 如需：在 `routes.js` 的错误分支中，将异常通过 `error` 推送（目前已做），前端 `useWebSocket.js` 收到后提示。