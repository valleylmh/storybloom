# 手机 Web App

入口：页面底部「添加到主屏幕」，或 `/install`。iOS 使用 Safari 分享菜单；Android 使用 Chrome 安装菜单。安装后从 `/library` 以独立窗口启动。

Service Worker 只在生产模式注册，部署环境须支持 HTTPS（localhost 例外）。无需额外依赖。`/sw.js` 禁止 HTTP 缓存；每次修改离线页面或缓存策略应递增 worker 内的版本号。更新等待旧窗口关闭后启用，不强制刷新正在编辑的页面。

缓存只包含离线提示页、同源公共绘本图片、应用图标和 Next 静态资源；最多保留 100 个动态缓存条目，空间不足时继续正常使用网络响应。HTML、RSC、API、家庭照片、跨域资源和音频不缓存。完整离线阅读暂未实现，已加载页面也不保证断网刷新可用。所有导航网络失败后回退离线提示页。

## 发布后的手机验收

1. HTTPS 下打开 `/install`，确认 manifest、图标和 `/sw.js` 均正常返回，等待 worker 激活。
2. Android Chrome 安装；iOS Safari 添加到主屏幕。确认图标、独立窗口、刘海区域和底部导航可用。
3. 在线打开绘本后断网：当前页出现离线提示；刷新显示离线提示页；恢复网络后点击按钮可回到绘本馆。
4. 检查 Cache Storage 不含 API、个人页面、家庭照片和带查询参数的请求。
5. 发布新版本后关闭全部旧窗口再打开，确认新 worker 接管并清理旧版本缓存。

本地验证：`npx tsc --noEmit`、`npx vitest run tests/webapp-worker.test.ts`。自动测试不能代替生产环境和真机安装验收。
