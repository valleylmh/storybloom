# StoryBloom 开源发布操作手册

当前私有仓库的 Git 历史仍包含已经从工作树删除的真实定制绘本，因此不要把当前仓库直接切换为 public，也不要对原仓库做 force-push。推荐新建一个干净的公开仓库。

## 发布前检查

```bash
npx tsc --noEmit
pnpm test
git diff --check
git grep -n -I -E 'gen\.valleylmh\.vip|storybloom-gamma\.vercel\.app|wechat-qrcode|public/custom-books|/custom-books/' -- ':!docs/open-source-checklist.md' ':!docs/open-source-release.md' ':!tests/custom-books.typecheck.ts'
```

确认 `.env`、`.env.local`、`.storybloom-cache`、`node_modules` 和 `.next` 不会进入发布目录；不要把本机缓存中的儿童照片或生成记录复制进去。

## 创建干净仓库

在当前目录的上一级创建一个临时发布目录，排除私有 Git 历史和本地运行产物：

```bash
rsync -a \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='.storybloom-cache' \
  --exclude='node_modules' \
  --exclude='.next' \
  ./ ../storybloom-open-source/

cd ../storybloom-open-source
git init -b main
git add -A
git diff --cached --name-only
git commit -m "Initial open-source release"
git remote add origin https://github.com/<your-account>/<your-public-repo>.git
git push -u origin main
```

先在 GitHub 创建一个空的 public repository，不要勾选 README、License 或 `.gitignore`，因为这些文件已经在本项目中准备好。公开后再在 GitHub 的 repository settings 中开启 private vulnerability reporting。

## 发布后的配置

在 Vercel、Cloudflare 或其他部署平台单独配置生产环境变量，不要把生产密钥写回公开仓库。至少确认 `NEXT_PUBLIC_APP_URL`、`NEXT_PUBLIC_SUPABASE_*`、服务端 Supabase key、Turnstile、Resend、图片 provider 和你自己的 `CPA_BASE_URL` 已按实际部署填写；未配置文本端点时，应用会使用本地 fallback。

如果启用绘本视频，再确认 Remotion license 资格和 `NEXT_PUBLIC_REMOTION_LICENSE_KEY`；否则设置 `NEXT_PUBLIC_STORY_VIDEO_ENABLED=0`。
