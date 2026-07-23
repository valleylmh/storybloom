# StoryBloom 开源准备清单

> 生成日期:2026-07-22。基于全量代码安全审计 + git 全历史(79 个 commit)密钥泄露扫描。
> 当前仓库状态:GitHub 私有仓库 `valleylmh/storybloom`,git pack 378MB。

## 结论摘要

- ✅ **git 历史干净**:`.env` 从未提交过;对全部 79 个 commit 做了两轮扫描(通用密钥模式 + `.env` 中每个真实密钥的精确值),均无命中;commit message 也无泄露。**开源不需要因"历史泄露"而轮换密钥**。
- 🔴 **最大的问题不是密钥,是隐私内容**:`public/custom-books/` 里是用真实孩子照片定制的两本绘本(可识别的儿童形象 + 生日/年龄/幼儿园毕业信息),连同历史共 188MB,已随每个 commit 进入 git 历史。**直接把现有仓库切成 public 等于公开这个孩子的形象,必须先重写历史或换新仓库**。
- ⚠️ 模型层没有开源障碍(全部是公开商用 API,无本地权重),但个人 CPA 中转地址被硬编码为 4 处默认值,需要去掉。
- ⚠️ 安全审计发现 5 个中危(SSRF、配额绕过、无限流的计费接口),代码公开后更容易被利用,建议开源前修复。

---

## P0 — 开源前必须完成

### 1. 隐私内容移除(含 git 历史)

- [x] 工作树已删除 `public/custom-books/`(真实孩子的定制绘本)；原私有仓库历史仍保留，公开仓库必须走新仓库或历史重写路线
- [x] `src/lib/custom-books.ts`、`src/app/custom/page.tsx`、`src/components/custom/CustomSampleGallery.tsx` 已改为公开 AI 样例，不再引用真实定制成品
- [x] 已删除 `public/custom-contact/wechat-qrcode.jpg`；`CustomContactPanel` 只使用部署者自己配置的平台链接
- [ ] **重写 git 历史**(见文末"推荐开源路径")——上述文件在历史 blob 中共约 188MB,`git rm` 只删工作树,历史仍在
- [ ] 决定是否介意提交者邮箱公开:全部 commit 作者为 `785138198@qq.com`(个人 QQ 邮箱)。换新仓库重新提交时可改用 GitHub noreply 邮箱
- [ ] `StoryBloom_PRD_v1.0.docx` 与 `docs/feature-roadmap-tasks.md`:已做 PII 扫描无个人信息,属内部文档,自行决定去留

### 2. 个人基础设施引用清理(已 git 跟踪,会随开源公开)

个人 CPA 中转 `gen.valleylmh.vip` 被硬编码为**默认值**——别人部署时若未配置会把流量打到你的私人服务上:

- [x] `src/app/api/character-recognition/route.ts`、`src/lib/story-generator.ts`、`src/lib/email/daily-inspiration.ts`、`src/lib/image-generator.ts` 已去掉个人中转默认值
- 处理方式:去掉默认值,未配置 `CPA_BASE_URL` 时直接禁用该 provider/走本地 fallback(代码已有无 key 兜底逻辑)

其他引用:

- [x] `.env.example`、`README.md`、`tests/newsletter.test.ts` 已改为部署者占位端点
- [x] Pollinations User-Agent 已改用 `NEXT_PUBLIC_APP_URL`

### 3. 环境变量与密钥

- [x] ~~排查 git 历史是否泄露 key~~ → 已完成,干净(见结论摘要)
- [x] ~~`.gitignore` 覆盖检查~~ → `.env`/`.env.local`/`.storybloom-cache`/`output/`/`.claude` 均已忽略 ✅
- [ ] `.env` 只存在于本地,里面是全套真实密钥(DashScope、Cloudflare、HuggingFace、Agnes、Supabase service_role、Resend、webhook secret 等)——确认不会被任何发布/打包流程带出
- [ ] `.env:42` 注释里写了 Supabase **数据库密码**,建议移到密码管理器,不要留在文件里
- [ ] `CPA_API_KEY=A-123456` 过于简单,而中转地址会随代码公开 → 换强随机 key
- [ ] `.storybloom-cache/character-references/` 有上传照片的缓存,确认不进任何发布产物
- [ ] (可选,求稳)开源同时轮换 Supabase service_role、Resend、Cloudflare token——历史干净,严格说不必,但成本低

### 4. 安全漏洞修复(代码公开后攻击者可直接读到绕过逻辑)

中危:

- [x] **M1 SSRF**:分享存储现在只接受经过校验的 `data:` 图片或站内相对路径，不再抓取浏览器提交的远程 URL
- [x] **M2 Turnstile 绕过**:服务端和表单端都移除了基于微信 UA 的安全豁免
- [x] **M3 免费配额绕过**:每日额度键始终包含 IP，并可附加浏览器指纹
- [x] **M4 无限流的计费接口**:人物识别已加入 per-IP 限流
- [x] **M5 无限流 + 任意 prompt**:插画接口已加入 per-IP 限流，并只从服务端故事缓存恢复故事，不再接受浏览器快照

低危(可开源后修):

- [x] L1 `/api/pollinations-image` 已限定 prompt/尺寸并加入 per-IP 限流
- [ ] L2 `/api/audio` 未认证可用任意文本消耗 TTS 配额(已有 30/min/IP + 缓存缓解)
- [x] L3 订阅接口对外统一返回泛化状态，不再暴露 `confirmed`
- [ ] L4 = 上面第 2 节的个人中转默认值问题

### 5. 开源合规文件

- [x] 已添加 `LICENSE`（MIT；`package.json` 的 `"private": true` 保留）
- [x] README 已明确说明 **Remotion 许可** 与部署者自带凭据责任

---

## P1 — 建议(提升开源质量)

- [x] README 已补充开源说明、无 key fallback、第三方端点和 Remotion 许可
- [x] 已增加 `SECURITY.md` 与 `CONTRIBUTING.md`
- [ ] `docs/` 内部任务文档(`feature-roadmap-tasks.md` 等)清理或移出
- [ ] 仓库瘦身:走"新仓库"路线后自动解决(378MB pack → 约 30MB;`public/sample-books/` 11MB 样例图 + 3 个 mp3 可保留)

---

## 模型公开可用性结论

**无自研模型、无本地权重,全部通过公开商用 API 调用,开源不涉及模型分发问题。** 部署者自带 key(BYO key),无 key 时代码已有本地兜底(SVG demo 图 / 本地 fallback 故事 / 浏览器朗读)。

| 用途 | 模型 | 服务方 | 公开可用性 |
|---|---|---|---|
| 故事文本 / 角色识别 | gemini-3-flash | **个人 CPA 中转**(OpenAI 兼容协议) | ⚠️ 中转本身不可公开;协议标准,用户可自带任意 OpenAI 兼容端点。需按 P0-2 去掉默认地址 |
| 图生图 | gemini-3.1-flash-image | 同上 CPA 中转 | ⚠️ 同上 |
| 插画 | flux-1-schnell / SDXL | Cloudflare Workers AI | ✅ 公开注册 |
| 插画 | qwen-image-2.0-pro | 阿里云 DashScope | ✅ 公开注册 |
| 插画 | FLUX.1-schnell(Apache-2.0) | HuggingFace Inference | ✅ 公开注册 |
| 插画 | Pollinations | pollinations.ai | ✅ 免 key |
| 图生图 | agnes-image-2.1-flash | apihub.agnes-ai.com | ✅ 第三方商业 API,可注册 |
| 样例音频生成(脚本) | cosyvoice-v3-flash | 阿里云 DashScope | ✅ 公开注册 |
| 站内朗读 | 浏览器 SpeechSynthesis | 无服务端依赖 | ✅ |

内容侧:成语故事、西游记为公版题材;样例图为 AI 生成(`public/sample-books/` 下 gpt-image-2 / nano-banana 目录名会暴露生成模型,无实质风险)。

---

## 安全审计已验证无问题项(可放心)

- Cron 鉴权:`timingSafeEqual` 常量时间比较,未配置时 503
- Resend webhook:svix 签名校验正确
- Supabase service_role 隔离:仅服务端引用,相关模块均 `import "server-only"`,无 client 组件泄露
- RLS:全部 6 张表启用,策略正确(服务端表 revoke anon;family 表 `auth.uid()` 逐行隔离;photos/audio 桶私有)
- 家庭角色生成接口:鉴权 + 属主校验 + 路径前缀校验,无越权/穿越
- Newsletter token:32 字节随机 + sha256 存储 + HMAC + 常量时间比较
- 分享/删除 ID:nanoid 14/24 位,不可猜
- `NEXT_PUBLIC_*` 变量均为合法公开值,无密钥混入
- `.env.example` 全部留空,无真实凭据
- 脚本与测试无硬编码密钥;错误日志不含密钥

---

## 推荐开源路径(确保安全)

**方案 A(推荐):清理后推全新公开仓库**

1. 完成上面 P0 的代码清理与安全修复,`npx tsc --noEmit` + `pnpm test` 验证
2. 复查:`git ls-files` 过一遍要公开的文件;可再跑一次 `gitleaks detect`(或用本清单的扫描方式)
3. 在清理后的工作树上以单个 initial commit 初始化新仓库,推到新的公开 repo
4. 现有私有仓库原样保留,作为你自己的完整历史存档

一次性解决:孩子绘本的历史残留、378MB 仓库体积、QQ 邮箱暴露。代价是公开仓库没有历史提交记录。

**方案 B(保留提交历史):git-filter-repo 重写**

1. `git filter-repo --invert-paths --path public/custom-books --path public/custom-contact`
2. 推到**新建**的公开仓库

⚠️ 不要在原仓库 force-push 后直接切 public:GitHub 对被重写掉的旧对象仍可能通过 SHA 直接访问,需联系 GitHub support 做 GC 才彻底。新仓库最干净。

**两个方案共同的最后一步**:切公开前,把 Vercel/Cloudflare 上的生产环境变量与代码解耦确认一遍(生产密钥只存在于部署平台,与仓库无关)。
