# 绘本定制工作台

## 已实现

- `/custom`：账号登录、4–12 页分镜、审核后生图、封面、跨页、参考照片与修图指令。
- 生图默认 `gpt-image-2`，独立于普通生成器的 provider 配置。角色参考图、普通页面和跨页均通过 GPT 图片接口；上传的成品插图没有 AI 处理要求时原样使用。
- 整本 PDF 在浏览器以和预览相同的 canvas 绘制器合成。封面独立，跨页合为一张宽 PDF 页，正文页数仍按物理页计数。文字溢出会阻止导出。
- Supabase 服务端事务每个账号每周免费一次，北京时间周一重置。生成预占，成功确认，终止失败退还；用户在 AI 开始后主动取消会使用该机会，避免取消绕过额度。
- 兑换码使用 160-bit 随机值，数据库只存 SHA-256，一码一次、绑定账号。重复兑换同一码不会重复到账。每账号每小时至多 10 次尝试。
- 每步独立领取 5 分钟租约，处理结果持久化。失败最多 3 次，重试不再扣用户机会。过期租约必须用户主动恢复，不自动重复不确定的上游请求；保存成功但发布失败时优先复用已存图片。
- 成品支持保存文字和排版，不消耗生成机会；原始任务输入与生图模型固定。
- 素材在私有 `custom-books` 桶中，浏览器只拿有效期一小时的签名 URL。工作台的云端记录与图片纳入全量云端数据删除；正在生成的任务需先完成或取消。

## 启用步骤

1. 在目标 Supabase 执行 `supabase/migrations/202609150001_custom_book_workbench.sql`。这只新增工作台表、函数和私有桶，不更改普通绘本的额度。
2. 已有 `CPA_BASE_URL`、`CPA_API_KEY` 可直接用于 GPT。可用 `CUSTOM_BOOK_IMAGE_BASE_URL` / `CUSTOM_BOOK_IMAGE_API_KEY` 单独覆盖。默认 `CUSTOM_BOOK_IMAGE_MODEL=gpt-image-2`。
3. 分镜沿用已配置的文字模型；若它缺少密钥，使用 CPA 的 `gemini-3.5-flash-lite`。可通过 `CUSTOM_BOOK_TEXT_MODEL` 单独指定。
4. 在工作台登录测试账号，填写最小 4 页故事 → 创建分镜 → 确认 → 生成 → 下载 PDF。刷新后在「我的绘本任务」继续。
5. 如需关闭网页后自动继续，由部署环境调度器每隔数分钟调用 `POST /api/cron/custom-books`，携带 `Authorization: Bearer <GENERATION_WORKER_SECRET>`；一次处理一个单元。未配置调度器时仍可重新打开工作台恢复，不会丢失已完成图片。

管理端生成兑换码：

```sh
node --env-file=.env --env-file=.env.local scripts/create-custom-book-codes.mjs --count 10
```

兑换码默认有效期 90 天，一码增加一本。明文仅写入 `.private/custom-book-codes/<批次UUID>.json`（目录权限 0700、文件权限 0600），终端只输出批次、路径和登记结果。该目录已加入 Git 忽略；仍应避免云同步、日志采集、截图及公开分发。脚本需要服务端 Supabase 凭据，这些凭据不会发送到浏览器。文件先保存、再登记数据库，因此文件存在不等于兑换码可用；网络结果不确定时必须按批次核查，不能盲目重跑生成。

## 接口

所有 `/api/custom/*` 路由要求有效 Bearer 登录凭证。

- `GET /api/custom/jobs`：服务端额度、重置时间、近期任务。
- `POST /api/custom/jobs`：幂等任务 id、经校验的草稿；原子预占。
- `GET /api/custom/jobs/:id`：仅所有者读取任务和签名图片。
- `POST /api/custom/jobs/:id`：advance / confirm / cancel / layout。客户端不能指定模型、改变已锁定图片或自行发放额度。
- `POST /api/custom/assets`：受限图片上传、解码重编码，移除原图元数据。
- `POST /api/custom/redeem`：兑换一次性代码。

## 已执行验证与上线边界

- GPT Image 2：真实图生图返回 1254×1254 JPEG，使用公开虚构人物示例，已目视检查。
- 分镜：已通过当前可用 CPA 文字模型生成完整四页正文与画面描述。
- PDF：用实际导出代码生成含跨页的整本文件，检查页数并渲染校对中文与版面；浏览器下载通过。
- PostgreSQL：PGlite 执行整份迁移，测试重复提交、任务越权、租约、额度提交/退还及重复兑换。
- 40 项相关测试（含账户删除回归）及 TypeScript 检查通过；普通生成接口未修改。
- 当前目标 Supabase 返回新表不存在，迁移尚未执行；没有数据库连接凭据或 management token。真实账号完整生成/兑换链路仍需迁移后验证。
- 本轮没有发布部署或创建可流通兑换码。

## 精品图文一体（2026-09-15）

新草稿默认 `renderingMode: integrated`，无此字段的历史草稿仍按 editable 处理。角色参考图不含文字；封面、独立内页和完整跨页由 GPT 根据准确正文及 `artDirection` 一体生成。内页增加成品封面视觉参考，文字模型为每页规划自然留白、位置与断行。用户可在分镜阶段调整构图要求。

成品素材以 `embeddedText` 保存当次准确文案快照。渲染器完整等比显示此类图片，不再裁切、应用模板或叠加正文；该规则跟随素材而非当前模式开关。预览与 PDF 共用此分支。修改文字或取消跨页导致快照不符时提示并阻止 PDF，服务端保存同样拒绝将未更新的图中文字伪装成新成品。

图文一体生成始终重新绘制封面和内页，上传图只作为参考，避免将无文字的上传素材当作已完成的图文成品。沿用原任务租约、输出恢复与额度逻辑。成品 PDF 下载前要求用户逐页确认校对；此确认是人工校对，不是自动 OCR 或质量保证。错字修复目前通过新的整本生成操作处理，不提供免费的局部 AI 修复。

现阶段不宣称自动达到夏日样书质量：中文准确率、人物一致性和自然构图需实图验收。四种程序排版仅用于 editable 模式；integrated 模式依照每页构图要求生成，不套用已有图像裁切模板。

### 实图验收样书：雨后的小小花园

`public/sample-books/integrated-garden/` 保存 GPT Image 2 实际返回的封面、page-1、page-2（2–3连续跨页）、page-4，及相应草稿和通过当前导出函数生成的 `book.pdf`。工作台“新建 / 载入示例”提供载入入口。

样书使用仓库已有 summer-pocket 公开虚构人物封面作为初始视觉参考；后续三张内页以新生成封面为参考，通过项目 `imagePrompt` / `requestCustomImage` 实际调用生成。文案和分镜是固定测试输入，本次未绕过账号接口宣称账号全流程通过。跨页请求曾返回500，保留已成功图片后仅恢复缺失输出，最终完成。四张原图逐张目视核对文字、人物和构图；PDF四张页面经Poppler渲染检查，跨页为一张宽页，无重复叠字。桌面工作台已实测样书载入、模式切换和跨页阅读。

尚未应用生产数据库迁移，未验证登录账号任务、额度扣退与兑换码的真实端到端运行；本次实图结果不代表生产服务已部署。


## 兑换码安全上线步骤（2026-09-17）

按顺序执行工作台迁移 `202609150001_custom_book_workbench.sql` 和 `202609170001_custom_book_code_security.sql`。第二份新增批次、指定账号和撤销字段，并更新兑换函数；现有已发行码仍可兑换。删除指定账号会连带删除其定向码，避免退化为任何人都可兑换的码。

定向发行（用真实账号 UUID 替换 ACCOUNT_UUID，不使用邮箱，不在命令行传明文兑换码）：

```sh
node --env-file=.env --env-file=.env.local scripts/create-custom-book-codes.mjs --count 1 --days 30 --user ACCOUNT_UUID
```

核查批次、撤销尚未使用的码（用生成时输出的批次 UUID 替换 BATCH_UUID）：

```sh
node --env-file=.env --env-file=.env.local scripts/create-custom-book-codes.mjs --status-batch BATCH_UUID
node --env-file=.env --env-file=.env.local scripts/create-custom-book-codes.mjs --revoke-batch BATCH_UUID
```

不传 `--user` 是任何登录用户可先到先得的通用码。撤销仅影响未使用码，不追回已兑换的机会。批次状态只输出数量，不显示明文或哈希。请确认批次 total 与私密文件中的数量一致、available 状态符合预期后再发放。

本地验证覆盖定向码跨账号拒绝、撤销、过期、账号删除、重复入账、限速和权限。真实上线仍需迁移后用两个测试账号验证兑换、重复兑换及生成扣退；不把本地 PGlite 测试当作线上验收。

2026-09-17 最新只读核验：`custom_book_codes` 与 `custom_book_jobs` 基础字段查询均返回 200（limit=0，未读取业务记录）；查询新安全字段返回 400 / PostgreSQL 42703。说明此前基础表已建立，但本次安全升级未执行。该观察取代上文“基础表尚不存在”的旧快照；无需重复执行基础建表迁移。当前环境无 DATABASE_URL / SUPABASE_DB_URL / SUPABASE_ACCESS_TOKEN，升级 SQL 需经数据库管理通道执行。未发行真实兑换码、未运行生产兑换或撤销操作。
