## 方案概述
- 使用 electron-builder 的 `portable` 目标生成单个可执行文件（无需安装），满足“将 Sqlite3.db 与 EXE 置于同一目录即可运行”的需求。
- 保留现有最小窗口与数据库目录校验逻辑：生产环境仅在 EXE 同目录查找 `Sqlite3.db`，缺失则提示 5 秒后退出。

## 配置变更
- 修改 `electron-builder.yml`：
  - 设置 `win.target` 为 `portable`（单个 EXE）。
  - 设置 `compression: maximum`、`asar: true` 以减小体积、提高加载速度；原生模块由 electron-builder 自动外置可用。
  - 移除 `extraResources` 对 `Sqlite3.db` 的打包项，避免混淆，让外部放置为唯一来源。
- 保留 `asarUnpack` 现有配置用于资源文件（如有）。

```yaml
# electron-builder.yml 关键段落（示例）
appId: your.app.id
productName: 快手监控工具
files:
  - '!**/.vscode/*'
  - '!src/*'
  - '!electron.vite.config.{js,ts,mjs,cjs}'
  - '!{.eslintcache,eslint.config.mjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}'
  - '!{.env,.env.*,.npmrc,pnpm-lock.yaml}'
asar: true
compression: maximum
asarUnpack:
  - resources/**
win:
  target:
    - target: portable
      arch: x64
  artifactName: ${productName}-${version}-portable.exe
# 移除原来 extraResources 的 Sqlite3.db/ks_overview.db 条目
```

## 构建命令
- 开发到打包：
  - `yarn build` 或 `npm run build`（先构建）
  - 生成 Portable EXE：
    - `electron-builder --win portable`（或新增脚本 `build:win:portable`）

## 使用与验证
- 将生成的 `快手监控工具-<version>-portable.exe` 与 `Sqlite3.db` 放在同一目录。
- 双击运行：
  - 若 `Sqlite3.db` 存在：应用正常启动，读取用户数据。
  - 若缺失：弹出提示，5 秒后自动退出（已在主进程实现）。
- 窗口尺寸验证：尝试缩小窗口，宽高不应低于 1360×880。

## 注意事项
- Portable EXE 不包含自动更新；若需要安装/更新体验，可额外保留 `nsis` 目标生成安装包。
- 某些杀毒软件对“单文件可执行 + 最高压缩”较敏感，如遇误报可将 `compression` 改为 `normal`。
- 原生模块（`sqlite3`）已外部化并在打包时重建；无需额外处理。

如同意，我将直接修改打包配置并添加 `build:win:portable` 脚本，执行打包并给出生成路径与验证步骤。