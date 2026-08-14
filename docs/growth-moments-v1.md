# GrowthMoment / StorybookVersion v1

StoryBloom 的本地成长档案现在把“真实发生的成长时刻”和“根据它生成的绘本”分开保存。

## 数据边界

`GrowthMoment` 只保存家长明确提供或确认的事实：

- 孩子本地标识与显示名称；
- 发生日期、家长备注和创作来源；
- 家长确认事实、允许的想象范围和确认标签；
- 最多 4 张现场照片。

`StorybookVersion` 保存一次绘本生成结果及其版本元数据：

- `storyId`、正文、插图和阅读年龄；
- 插画风格、故事处理方式、模型与 Provider 信息；
- 该版本可选的家庭角色引用。

家庭角色引用属于单个绘本版本，不属于 `GrowthMoment`。因此 `ChildProfile`、`FamilyCharacter` 和真实成长时刻仍是独立实体。

## 本地兼容迁移

本地数据库继续使用 `storybloom-growth-records`、版本 `1` 和既有 `records` object store，不删除或改写 object store。新数据使用 shadow envelope：

```text
moment:<momentId>
storybook:<versionId>
```

每个仍有绘本版本的 Moment 同时保存一个旧 `GrowthRecord` 投影。旧页面会过滤掉 shadow envelope，只读取兼容投影；新页面读取 Moment 和全部版本。第一次读取旧记录时会幂等补写 shadow envelope，不上传网络。

如果一个 Moment 的最后一个绘本版本被删除，Moment 和现场照片仍保留，但不再生成虚假的旧 `GrowthRecord` 投影。新版时间轴会显示“当前没有绘本版本”；回滚到只认识旧投影的客户端时，这条 Moment 暂时不可见，但数据不会被删除。

## 从同一个 Moment 创建新版本

本机时间轴中的“再生成一个版本”与“生成第一个绘本版本”会建立一个短期浏览器意图。URL 只包含 `growthVersion=1`，真实 `momentId` 只进入当前标签页的 `sessionStorage`，日期、备注、事实和照片不会进入 URL。

进入创作页后：

- 真实日期、家长备注、确认事实、允许想象和现场照片只读复用；
- 家长仍需再次勾选事实确认；
- 阅读阶段、故事处理方式、插画风格和可选家庭角色引用属于本次新版本；
- `growthRecordDraft` 与 `targetMomentId` 只保存在浏览器任务恢复记录中，生成 API payload 会明确剥离它们；
- 文本、大纲确认和逐页插画继续复用现有可恢复任务；
- 第一次取得故事结果后，本地 repository 会验证 Moment 存在且孩子标识一致，再按 `storyId` 幂等追加 `StorybookVersion`；不会新建或覆盖真实 Moment。

如果版本归属失败，生成后的绘本仍保存在本机绘本记录中，但原 Moment 不会被修改，也不会自动回退为一条新的成长记录。

## 删除语义

| 操作 | Moment 事实/备注 | 现场照片 | 其他绘本版本 | 绘本馆独立副本 |
|---|---:|---:|---:|---:|
| 删除一个绘本版本 | 保留 | 保留 | 保留 | 不自动删除 |
| 删除全部现场照片 | 保留 | 删除 | 保留 | 不修改 |
| 删除整个 Moment | 删除 | 删除 | 删除 | 不自动删除 |

## 本机照片容量与去重

成长现场照片仍先在浏览器缩放、重编码为 WebP 并移除 EXIF。新保存的 `GrowthMomentAsset` 和兼容 `GrowthRecordPhoto` 会附带可选的 `mimeType`、`byteSize` 与 `checksumSha256`；旧对象不要求这些字段，因此无需升级 IndexedDB object store。读取旧记录或再次写入 Moment 时，会在本机按需补齐元数据。

照片指纹基于重编码后的真实字节，不使用文件名、儿童标识或原文件元数据。同一 Moment 内字节相同的照片只保留第一份；选择照片和 IndexedDB 写入边界都会检查一次。照片仍不会进入生成 API、URL、服务端日志或 cloud repository。

容量提示只调用当前 origin 的 `navigator.storage.estimate()`：

- 显示本站估算用量、配额和本次照片预计新增占用；
- 接近阈值时预警，但不会仅因预警阻止创作；
- 只有预计新增量明确超过剩余配额，或 IndexedDB 实际返回 `QuotaExceededError` 时才阻止照片写入；
- 不支持 estimate 的浏览器仍可继续，保存时由 IndexedDB 实际结果兜底；
- 不调用 `navigator.storage.persist()`，不自动申请持久化权限；
- 删除现场照片或整个 Moment 后，时间轴会重新读取容量快照。

界面分别说明配额不足、浏览器本机资料库不可用和普通写入失败。为了兼容旧读取路径，仍有绘本版本的 Moment 会同时保存 shadow Moment 与旧 `GrowthRecord` 投影，因此新增照片占用估算按两份本机兼容数据计算；这不代表照片被上传或创建了跨 Moment 的全局资产关联。

## 本机导出、保留期限与完整删除

成长书架中的治理面板只读取当前浏览器的本机 `GrowthMoment` 数据：

- 显示本机孩子分组、成长时刻、现场照片和绘本版本数量；
- 解释孩子分组键、日期、事实、备注、照片和绘本版本为什么保存；
- 在浏览器内生成 ZIP，包含 `archive.json`、字段说明和当前可读取的图片文件；
- 导出清单不包含 Data URL、登录／删除令牌、临时签名链接、Provider 任务 ID、旁白音频、家庭角色库、私有云副本或公开分享凭据；
- 保留期限偏好只保存策略与更新时间，不保存儿童资料；到期判断使用真实发生日期；
- 到期策略只生成预览，不设置定时器，也不会在打开页面、登录或生成时自动删除；
- 删除到期内容或全部本机成长档案都需要家长再次确认。

完整删除只清理 `storybloom-growth-records` 中的成长档案数据，并尽力移除当前登录账户对应的本机成长记录导入状态。普通绘本馆／最近作品、家庭角色、真实声音、公开分享和私有云副本都不会被连带删除。导出与删除不会开启云同步，也不会向服务器发送本机档案。

## 云端状态

`supabase/migrations/202608140001_growth_moments_storybook_versions.sql` 只建立未来兼容基础：

- 新增 `growth_moments`、`growth_moment_assets` 和 `storybook_versions`；
- 所有关系都带 `user_id` 复合外键并启用 RLS；
- 不回填旧 `growth_records`；
- 不创建或开放任何 Storage policy；
- 不修改 `account_settings.cloud_sync_enabled`；
- 当前 cloud repository 不读取或写入这些表。

该 migration **尚未部署，也未做生产多设备验证**。未来部署前需先确认并依次执行已有基础 migration：

```text
supabase/migrations/202608090001_cloud_growth_archive.sql
supabase/migrations/202608090002_local_import_sync_foundation.sql
supabase/migrations/202608140001_growth_moments_storybook_versions.sql
```

部署 schema 不代表允许同步。只有在家长主动选择具体内容、明确确认照片上传范围，并完成 RLS、私有 Storage、删除和多设备恢复验收后，才能接入 cloud repository。登录本身永远不触发本地儿童数据上传。
