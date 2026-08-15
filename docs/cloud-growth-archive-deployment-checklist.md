# 私有云成长档案治理部署与多设备验收清单

本清单用于验收私有云成长档案的专用摘要、ZIP 导出、保留期限预览和明确确认删除。完成代码合并不等于生产可用；只有真实 Supabase 项目完成以下检查后，才能对外宣称跨设备成长档案治理已上线。

## 当前项目记录（2026-08-15）

- 已完成三个 migration、9 张相关表、RLS、私有 Storage、容量限制和匿名访问阻断检查。
- 已用两个临时账户验证跨账户表与 Storage 隔离；临时账户和数据已清理。
- 已验证未登录 `401`、登录摘要、专用 ZIP、保留期限、错误确认阻断、到期删除及普通绘本保留边界。
- 已用纯合成临时账户验证主动导入同时写入 `growth_records` 与 GrowthMoment 新表，更新会同步镜像，删除成长档案不会删除 `saved_stories`。
- 尚需一项人工终验：同一账户在两台真实设备完成第 6 节的完整 UI 闭环。

## 1. 部署边界

- 登录不等于同意上传，本机 IndexedDB 不得因登录、查看或治理操作被自动导入。
- `account_settings.cloud_sync_enabled` 保持默认 `false`；开启后仍只允许家长逐项主动导入。
- `ChildProfile`、`FamilyCharacter`、成长时刻、绘本馆和公开分享继续作为独立实体。
- 保留期限只保存偏好并生成预览，不配置数据库定时任务、Edge Function cron 或页面自动删除。
- 专用删除只能处理 `growth_records`／`growth_record_photos` 和未来的 `growth_moments`／`growth_moment_assets`／`storybook_versions`；不得删除 `saved_stories`、家庭角色、声音或公开分享。

## 2. migration 顺序

在 Supabase Dashboard 确认目标项目、备份和当前 schema 后，依次执行：

```text
supabase/migrations/202608090001_cloud_growth_archive.sql
supabase/migrations/202608090002_local_import_sync_foundation.sql
supabase/migrations/202608140001_growth_moments_storybook_versions.sql
```

不得跳过前两项直接执行 GrowthMoment migration。第三项不回填旧 `growth_records`，也不创建 Storage policy；云端列表继续兼容读取旧表，只有家长主动选择导入或更新记录时才镜像写入新表。

## 3. schema 与 RLS 验收

- 确认 `account_settings.retention_days` 允许 `null` 和正整数，且 `cloud_sync_enabled` 默认 `false`。
- 确认旧表和三个新表都启用 RLS，并只有本人可 select/insert/update/delete。
- 使用两个测试账户验证：账户 A 不能读取、更新或删除账户 B 的任何成长记录、Moment、资产或版本。
- 确认所有关联外键包含 `user_id`，删除成长档案不会级联删除 `saved_stories`。
- 确认新表缺失时，治理摘要仍能兼容旧 `growth_records`；新表存在时，已迁移旧记录不会被重复计数。

## 4. 私有 Storage 验收

- `growth-record-photos` 必须保持 private，路径第一段为账户 `user_id`。
- 验证账户 A 无法签名、下载或删除账户 B 的对象。
- 验证专用 ZIP 只下载数据库引用且属于当前账户的 WebP；ZIP 内使用匿名顺序路径，不写入签名 URL。
- 验证完整删除会清理当前账户在 `growth-record-photos` 下的已引用对象和可识别孤儿对象。
- 验证 Storage 部分失败时接口返回 partial 报告，数据库删除结果不会被伪装为完整成功。

## 5. API 与交互验收

- 未登录访问 `/api/account/growth-archive` 和 `/api/account/growth-archive/export` 返回 401。
- 摘要、导出和删除响应包含 `no-store`，日志不记录请求正文、令牌或对象 URL。
- 保存 1／3／5 年偏好后，只更新 `retention_days`；刷新、登录和打开页面均不自动删除。
- 到期预览使用浏览器提交的合法 IANA 时区，在日期边界不提前或延后一天。
- 完整删除和到期删除都必须显示二次确认；错误确认文本不得启动删除。
- 删除成功后，本机成长书架、普通绘本馆、家庭角色、真实声音和公开分享保持不变。
- 专用 ZIP 不包含家庭角色库、声音、公开分享凭据、登录令牌、签名 URL、Provider 任务 ID 或无关绘本。

## 6. 两账户、两设备验收

1. 设备 A 使用账户 A，主动导入一个含照片和绘本的成长记录。
2. 设备 B 登录账户 A，不进行本机导入，确认只能在“私有云端”看到该记录。
3. 设备 B 导出专用 ZIP，核对正文、图片和字段边界。
4. 设备 B 修改保留期限，设备 A 刷新后应看到同一账户偏好；两端都不得自动删除。
5. 设备 B 删除一个到期时刻，设备 A 的私有云列表同步消失，但设备 A／B 各自本机副本仍保留。
6. 使用账户 B 验证无法读取账户 A 的摘要、ZIP、记录和 Storage。
7. 删除全部私有云成长档案，确认普通绘本馆独立副本仍存在并可阅读。

## 7. 发布判断

只有以上项目全部记录为通过，才能把“私有云成长档案可跨设备导出、设置保留期限并单独删除”标记为生产可用。任何 RLS、Storage、部分删除或跨设备恢复失败都应停止发布，并继续保留“未完成生产验收”的界面与文档提示。
