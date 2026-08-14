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

## 删除语义

| 操作 | Moment 事实/备注 | 现场照片 | 其他绘本版本 | 绘本馆独立副本 |
|---|---:|---:|---:|---:|
| 删除一个绘本版本 | 保留 | 保留 | 保留 | 不自动删除 |
| 删除全部现场照片 | 保留 | 删除 | 保留 | 不修改 |
| 删除整个 Moment | 删除 | 删除 | 删除 | 不自动删除 |

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
