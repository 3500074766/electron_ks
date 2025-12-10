<template>
  <el-container class="layout-container">
    <el-aside width="220px" class="aside">
      <div class="logo">
        <el-icon :size="24" color="#409EFF">
          <Monitor />
        </el-icon>
        <span>数据监控中心</span>
      </div>
      <el-menu :default-active="$route.path" class="el-menu-vertical" router :collapse="false">
        <el-menu-item index="/dashboard">
          <el-icon>
            <DataLine />
          </el-icon>
          <span>核心数据</span>
        </el-menu-item>
        <!-- 预留扩展位置 -->
        <el-menu-item index="/settings" disabled>
          <el-icon>
            <Setting />
          </el-icon>
          <span>系统设置 (开发中)</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <h2 class="page-title">{{ $route.meta.title }}</h2>
        </div>
        <div class="header-right">
          <!-- 可以在这里放用户信息、全局操作等 -->
          <el-tag type="info" effect="plain" round size="small">v1.0.0</el-tag>
        </div>
      </el-header>

      <el-main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout-container {
  height: 100vh;
  background-color: #f5f7fa;
}

.aside {
  background-color: #fff;
  border-right: 1px solid #e6e6e6;
  display: flex;
  flex-direction: column;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  border-bottom: 1px solid #f0f0f0;
}

.el-menu-vertical {
  border-right: none;
  padding-top: 10px;
}

.header {
  background-color: #fff;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
  padding: 0 20px;
}

.page-title {
  font-size: 18px;
  font-weight: 500;
  color: #303133;
  margin: 0;
}

.main-content {
  padding: 20px;
  overflow-y: auto;
}

/* 简单的过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
