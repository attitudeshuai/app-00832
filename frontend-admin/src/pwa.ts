// 简单的图标生成脚本 (实际项目中应使用真实图片)
// 这里我们假设 public 目录下已经有了 pwa 图标，或者用户需要自己放进去。
// 为了演示完整性，创建一个简单的 HTML 文件来生成图标是不行的，
// 我们直接在 index.html 里引用，并假设用户会按照 README 放图片。
// 但为了让项目跑起来不报错，我们创建一个空的 sw.js 注册逻辑 (vite-plugin-pwa 会自动处理)

import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    // 提示用户更新
    if (confirm('New content available. Reload?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline')
  },
})
