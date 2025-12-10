## 总体目标
- 合并 `electron-ks` 到现有 Electron 项目 `快手监控1`，形成一体化桌面应用。
- 用 Electron IPC 完全替换前后端 WebSocket 通信（`src/utils/socket.js`:2、`src/composables/useWebSocket.js`:33-71、74-196）。
- 将 Python 后端业务逻辑（用户/快手数据/ROI）迁移到 Electron 主进程（Node.js），本地持久化。
- 保持现有前端（Vue3 + Element Plus + Pinia）交互与数据结构不变。
- 打包为可独立运行安装包（Windows/macOS），无需任何外部服务。

## 目录与代码迁移
- 迁移范围：将 `d:\PycharmProjects\pythonProject\快手监控工具\electron-ks` 整体并入 `d:\PycharmProjects\pythonProject\快手监控工具\快手监控1`。
- 渲染进程：
  - 将 `electron-ks/src/**/*` 合并至 `快手监控1/src/renderer/src/`，替换示例页。
  - 在 `快手监控1/src/renderer/src/main.js` 集成 Element Plus 与 Pinia（`electron-ks/package.json`:11-17）。
  - 保留组件与存储结构（`src/views/MainView.vue`、`src/components/DataTable.vue`、`src/stores/dataStore.js`）。
- 静态资源与入口：按需合并 `index.html` 与 `assets`，保持样式与图标。
- 资源文件：将 `Sqlite3.db`、`ks_overview.db` 迁移到应用资源目录（后续由 `app.getPath('userData')` 管理）。

## 通信改造：WebSocket → IPC
- 预加载桥：在 `快手监控1/src/preload/index.js` 通过 `contextBridge` 暴露 `api`：
  - `api.getAllKuaishouData()`、`api.getAllRoiData()`、`api.updateRoi(payload)`、`api.refreshData()`、`api.updateInterval(mins)`。
  - 事件订阅：`api.on(channel, listener)` 与 `api.off(...)`，用于推送 `kuaishou_data|roi_data|users_data|update_roi_result|error`。
- 主进程 IPC：
  - 在 `快手监控1/src/main/ipc/routes.js` 注册 `ipcMain.handle/on`，映射请求与推送事件。
  - 将响应事件名与载荷保持与前端一致（见 `项目详细分析报告.md` 的协议节；例如 `update_roi_result`）。
- 前端适配：
  - 改造 `src/utils/socket.js` 为 IPC 管理器（保留同名方法 `init/emit/on/off/disconnect`，内部使用 `window.api`）。
  - `src/composables/useWebSocket.js` 无需大改，仅将 `socketManager` 的底层实现改为 IPC；事件名与 `sendMessage` 保持不变。

## 业务迁移：Python → Node（Electron 主进程）
- 模块对照：
  - `app/services/user_service.py` → `src/main/services/userService.js`
    - 读取 `Sqlite3.db` 的 `Mysqlks` 表（`app/data_access/mysqlks_repository.py`:21-59）。
    - 提供 `getAllUsers(useCache)`、`getUserByUid(uid)`、`refreshUsersCache()`。
  - `app/services/kuaishou_service.py` → `src/main/services/kuaishouService.js`
    - 使用 `axios` 调用快手接口（`settings.KUAISHOU_API_URLS.OVERVIEW`）。
    - 并发获取各用户 overview 数据、计算消耗变化（`change_value`）、`GMV/订单数/全站ROI`，并写入 `ks_overview.db`（`overview_repository.py` 逻辑合并）。
  - `app/services/roi_service.py` → `src/main/services/roiService.js`
    - 获取 `target_id` 与 `roi_ratio`（`CONTROL_PANEL_SEARCH`），并返回简化 ROI 列表。
    - 更新 ROI（`CAMPAIGN_UPDATE_BID`），成功后主进程推送 `update_roi_result` 并触发最新 ROI 刷新。
- 公共工具：
  - `src/main/utils/httpClient.js`：封装 `axios` 会话、重试与超时（参考 `app/utils/http_client.py`:16-52、53-88）。
  - `src/main/utils/db.js`：`sqlite3` 或 `better-sqlite3` 封装读取与写入（参考 `app/data_access/base.py`:12-43、44-70）。
  - `src/main/utils/cache.js`：LRU 缓存（参考 `app/utils/cache.py` 行为；`UserService` 使用）。
- 并发与限流：使用 `p-limit` 控制并发，限速与重试与 Python 等价（`settings.MAX_WORKERS/RETRY_DELAY`）。
- 路径与安全：所有敏感数据（`ck`）仅在主进程使用；不写硬编码路径（替换 `D:/...`，参考 `roi_service.py`:253-255），统一使用 `app.getPath('userData')`。

## 本地持久化
- 用户来源库：迁移并读取 `Sqlite3.db`（只读）。
- 运行时库：在 `userData/ks_overview.db` 存储 overview 历史与最近一帧，用于变化计算（对应 `OverviewRepository`）。
- 配置与缓存：在 `userData/config.json` 存储刷新间隔、上次更新时间等；内存缓存用于用户集合。

## 依赖与打包
- 新增依赖：
  - 运行时：`axios`、`pinia`、`element-plus`（渲染）、`sqlite3` 或 `better-sqlite3`、`p-limit`、`electron-log`。
  - 若 `better-sqlite3` 构建受限，回退到 `sqlite3`。
- 构建与打包：
  - 更新 `electron-builder.yml`：`extraResources` 打包 `resources/**` 与初始 `.db`；确保 asarUnpack 包含数据库。
  - 产物：`nsis`（Win）、`dmg`（mac），保留现有配置（`electron-builder.yml`:13-43）。

## 功能保持与一致性
- 事件名与载荷完全保持：`kuaishou_data|roi_data|users_data|update_roi_result|error`（`useWebSocket.js`:115-143、167-195）。
- 刷新策略：
  - `ROI` 每 15 秒刷新（前端已有，`useRefresh.js`）。
  - 快手数据按用户配置的分钟间隔；支持 `update_interval`（返回 `interval_updated`）。
- UI 与表格行为、合并策略完全复用（`src/stores/dataStore.js`:27-33、93-177）。

## 质量保证
- 自动化测试：
  - 主进程服务单测（`userService/kuaishouService/roiService`）模拟 API 与 SQLite。
  - 渲染进程组件测试（关键交互：刷新、ROI 更新）。
- 端到端验证：
  - 开发态：`npm run dev` 启动 Electron，验证 IPC 事件往返与页面渲染。
  - 打包态：`npm run build:win|mac` 后安装运行，校验无外部服务依赖。
- 性能对齐：
  - 并发拉取用时与 Python 基线相当；缓存命中率≥80%；刷新渲染无卡顿。
- 跨平台：
  - 路径统一（`path.join`、`app.getPath('userData')`）；避免任何 Windows 特定假设。

## 交付物
- 安装包：`Win(.exe)` 与 `macOS(.dmg)`。
- 文档：
  - 《项目迁移与重构说明》：包含目录变更、IPC 协议、服务实现概述、打包与运行指南。
  - 《技术架构图》：主进程服务/IPC/渲染进程数据流（包含事件名与持久化点）。
- 测试清单与结果：端到端与性能验证记录。

## 风险与应对
- SQLite 原生模块构建：优先 `better-sqlite3`，不通则回退 `sqlite3` 或 `sql.js`（仅读）。
- Kuaishou API 变更：所有解析路径容错、错误抛出与重试保持（参考 `kuaishou_service.py` 的健壮处理）。
- 敏感信息：`ck` 仅主进程持有；日志脱敏（渲染仅显示必要字段）。

## 下一步执行（确认后即实施）
1. 合并前端代码到渲染进程，安装 UI/状态依赖。
2. 搭建 `preload` 与主进程 IPC 层，提供与现有事件一致的 API。
3. 迁移并实现主进程服务，打通从 SQLite → API → 数据推送的全链路。
4. 本地持久化与资源打包配置，确保安装后可独立运行。
5. 完整测试与性能对齐，输出交付文档与架构图。