import { createRouter, createWebHashHistory } from 'vue-router'
import BasicLayout from '../layouts/BasicLayout.vue'
import Dashboard from '../views/Dashboard.vue'

const routes = [
  {
    path: '/',
    component: BasicLayout,
    redirect: '/dashboard',
    children: [
      {
        path: '/dashboard',
        name: 'Dashboard',
        component: Dashboard,
        meta: { title: '数据概览', icon: 'DataLine' }
      },
      // 方便后续添加新功能，例如：
      // {
      //   path: '/settings',
      //   name: 'Settings',
      //   component: () => import('../views/Settings.vue'),
      //   meta: { title: '系统设置', icon: 'Setting' }
      // }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
