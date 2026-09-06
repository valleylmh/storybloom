# StoryBloom 微信小程序

独立原生工程，复用网站公开绘本内容。当前 0.1.0 是纯图文版：搜索、系列筛选、双语逐页阅读、图片放大、阅读指南、收藏和续读。收藏与进度仅保存在本机；不登录、不使用云服务、不调用业务接口、不提供朗读。

## 首版发布工程

在被 Git 忽略的 `config.local.json` 中填写已注册的公开 AppID（可从 `config.example.json` 复制）。这里不接受 AppSecret、OSS AccessKey 或其他密钥。

在仓库根目录执行：

```sh
npm ci --prefix miniprogram
npm run mini:release
npm run mini:check
npm run mini:test
```

微信开发者工具导入 **`miniprogram/release`**，选择“不使用云服务”。生成目录中的 `project.config.json` 已写入本地配置中的真实 AppID，实际代码目录是 `dist/`。整个 release 目录被 Git 忽略，不会进入开源仓库。

发布工程包含 6 本完整绘本、56 页双语正文与本地压缩 JPEG 插画，封面在主包，逐页图片在阅读分包。无需等待 OSS。打包脚本检查每个分包不超过 2 MiB；最终包大小以微信开发者工具为准。`release/report.json` 记录本次内容与字节数。

书目：守株待兔、石猴出世、天空为什么是蓝色的、咏鹅、习惯会慢慢长大、红绿灯为什么会变色。图片为压缩后的移动端版本，放大清晰度有限。

上传版本号 `0.1.0`，说明见 `SUBMISSION.md`。上传后在小程序后台「管理 → 版本管理」提交审核；审核通过后才可发布。平台若提示备案、账号信息或类目等前置事项，按实际提示处理。

## 本地预览与后续扩展

`npm run mini:preview` 生成 `miniprogram/preview`，可选工具自带测试号验收相同的六本书，不用于发布。

`npm run mini:prepare` 导出全量已发布且插画完整的公开书目至 `miniprogram/dist`，当前包含 210 本、1778 页。它不是首版离线发布目录；全量插画需按 `assets-manifest.json` 上传 OSS，并填写 `config.local.json` 的 `mediaBaseUrl` 后重新导出。不要把网站 API 密钥放入小程序。

未来可配置 `audioManifest` 导出逐页静态音频地址。音频控制器与相关测试保留在源码供后续版本使用，当前阅读页未接入，首版发布包也不包含播放器模块；增加朗读需重新开发、验证并提审。

## 验收与交互

- 搜索和系列共同筛选；从阅读页原生返回保留目录状态与滚动位置。
- 中英同屏，长正文纵向滚动；明确横向滑动或按钮翻页，首尾不循环。
- 收藏、最近阅读和进度本机保存；存储失败提示并退回会话内保存。
- 失败图片原位点击重试，阅读指南面板可滚动。
- 真机检查 iPhone/Android 的胶囊、安全区、字体、图片预览与手势；检查 360/390/430px 布局和长文末尾。

详细已验证与待验证状态见 `VERIFICATION.md`。本地打包成功不代表上传、提审或发布成功。

## 复用网站图片测试

运行 `npm run mini:preview:web`（依赖已生成的六本书 release 工程和 assets-manifest.json），生成独立的 `miniprogram/web-media-preview`。可附加 HTTPS 媒体根地址：`npm run mini:preview:web -- https://example.com`。测试工程使用真实 AppID 并开启域名校验，正文随包、56 张图片直接读取网站公开原图，不包含本地图片或离线图片回退。该命令不修改 release，也不上传开发版本。

2026-09-06 验证：默认网站域名 storybloom.valleylmh.vip，56/56 图片返回 HTTP 200 image/webp；响应含 Cloudflare 和 Vercel 标识。微信 CLI 预览成功，包体 48,582 字节（约 47.4 KB）。原生模拟器已显示远端封面与守株待兔阅读插画；手机网络速度、真机域名限制仍待扫码确认。测试二维码及检查记录位于被 Git 忽略的 web-media-preview 目录。

## 朗读测试版（未替换已上传的 0.1.0）

按需生成：`npm run mini:preview:api-audio` 生成 `miniprogram/api-audio-preview`。六本书点击播放时通过 `wx.request` POST 到现有网站 `/api/audio`，仅发送当前页公开文字、语言和采样率，不需要客户端密钥。支持中文、英文、中英连播、翻页、段落高亮和暂停。接口返回 HTTPS 音频地址时直接流式播放，短期缓存只在内存中；返回 inline 音频时写入小程序自身本地文件，最多缓存 24 段，并清理上次运行遗留的同前缀文件。没有自动播放或预取生成。

后台需配置 request 合法域名 `https://storybloom.valleylmh.vip`。当前线上返回的音频来自 `ojsocxadsulxdhxndivp.supabase.co`，需在实际手机网络下验证播放可达性；实现没有使用 `wx.downloadFile`。保持域名校验开启。线上语音供应商由服务器现有配置决定，小程序不指定模型，不新增后端或修改线上配置。

备用预生成方案：`npm run mini:audio` 为 release 的六本书生成逐页音频到被 Git 忽略的 `audio-cache`，复用本地百炼配置，未配置或失败时使用现有 Edge TTS。已有文件按文字、语言与生成版本缓存，命令可续做。然后 `npm run mini:preview:audio` 生成 `audio-preview`，按书拆阅读分包，所有 112 段音频随对应分包加载。

2026-09-06：线上 `/api/audio` 实测返回 200，中文一页约 4.46 秒，模型 Edge TTS；返回 MP3 的文件地址也返回 200 audio/mpeg。49 项回归测试通过。接口测试版的真机请求与实际音频播放仍待验证；不能将 HTTP 可用和模拟器页面出现视作真机已通过。两个朗读工程均仅供测试，尚未上传提审。原来的 0.1.0 纯图文提审说明不适用于朗读版本。

## 全量绘本（图片复用网站、在线朗读）

`npm run mini:full` 导出全部已发布且插画完整的绘本，生成独立工程 `miniprogram/full-library`，在微信开发者工具导入该目录。此模式直接使用最新全量导出，不再从六本离线 release 截取书目；真实 AppID 从被忽略的 config.local.json 读取。

2026-09-06 当前包含 210 本／1778 页：成语 50、西游记 64、好奇为什么 30、唐诗 44、三字经 6、汽车小队 16。实际页数包含 8、9、10、12、14 页。每本正文、导读、本机收藏续读和按需在线朗读均接入；接口仅在点击播放后请求当前页。封面使用现有懒加载，不预生成全库语音。

微信预览包合计 963,925 字节（941.3 KB），主包 195,704 字节，阅读分包 768,221 字节。`full-library/preview-qr.png` 为预览二维码，`media-check.json` 保存线上图片检查结果。预览成功不代表已上传开发版本或通过审核；已上传的 0.1.0 纯图文版本保持原状。
