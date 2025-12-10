## 总体思路
- 用 Element Plus 的 `ElContainer/ElAside/ElMain` 做左右分屏，不再手写 Grid/Flex 高度/对齐。
- 用 `ElSpace` 管理垂直/水平间距，替代自定义 `margin/padding`。
- 用 `ElRow/ElCol` 做内容分区，必要时用 `ElDivider` 分隔；滚动用 `ElScrollbar`。
- 右侧内容通过 `router-view + keep-alive` 渲染，布局层不包滚动，滚动下沉到具体页面组件（表格区）。

## 具体改造
1) ShellLayout（左右框架）
- 替换为：
  ```vue
  <ElContainer style="height:100vh">
    <ElAside :width="collapsed?64:sidebarWidth">
      <ElCard shadow="always">
        <SidebarCard ... />
      </ElCard>
    </ElAside>
    <ElMain>
      <ElCard shadow="always">
        <router-view v-slot="{ Component }">
          <keep-alive><component :is="Component"/></keep-alive>
        </router-view>
      </ElCard>
    </ElMain>
  </ElContainer>
  ```
- 删除自定义 Grid/CSS 高度；侧边宽度由 `ElAside` 控制。

2) MainView（右侧内容页）
- 用垂直 `ElSpace` 管理上下间距：
  ```vue
  <ElSpace direction="vertical" size="large" style="width:100%">
    <HeaderActions ... />
    <ElDivider></ElDivider>
    <ElScrollbar style="height:calc(100vh - 220px)">
      <DataTable ... />
    </ElScrollbar>
  </ElSpace>
  ```
- 移除 `.main-view` 的自定义 `padding/margin`。

3) HeaderActions（工具栏）
- 把内部横向排版改为 `ElSpace size="large" wrap` 组合按钮和输入，删除自定义 `gap/margin`；更新时间信息用 `ElSpace` 纵向对齐。

4) SidebarCard（侧栏）
- 外层用 `ElCard`；内部菜单保持 `ElMenu`，上下区块间距用 `ElSpace`；小屏折叠靠 `ElAside` 宽度即可，无需额外 CSS。

5) 统一规则
- 由 `ElCard` 自带内边距+`ElSpace` 统一间距；仅保留必要的 `style`（如固定高度值），不再写局部 `margin`。
- 滚动统一用 `ElScrollbar` 包在数据表格区域。

## 验证
- 右侧无额外空白；左右严格对齐，窗口缩放不破坏对齐。
- 切换路由保持表格计时与数据；滚动只作用在数据区。
- 小屏侧栏收缩，右侧内容占满。

## 交付文件改动
- `src/renderer/src/components/ShellLayout.vue`：改用 `ElContainer/ElAside/ElMain`。
- `src/renderer/src/App.vue`：引用新布局结构。
- `src/renderer/src/views/MainView.vue`：用 `ElSpace + ElDivider + ElScrollbar` 重排。
- `src/renderer/src/components/HeaderActions.vue`：内部用 `ElSpace` 管理间距。
- `src/renderer/src/components/SidebarCard.vue`：用 `ElSpace` 优化区块间距，减少样式。