## 原因
- 报错显示 `Failed to resolve import "vue-router"`，说明项目未安装 `vue-router`。

## 方案
- 使用包管理器安装运行时依赖 `vue-router`。
- 安装后无需代码变更，入口已引入路由并注册；重新运行开发或打包即可。

## 安装命令（二选一）
- Yarn：`yarn add vue-router`
- pnpm：`pnpm add vue-router`

## 验证
- 运行 `yarn dev` 或 `pnpm dev`，确认不再弹出导入错误，应用正常加载。