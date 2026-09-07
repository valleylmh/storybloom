# StoryBloom Agent Notes

- 日常迭代不默认运行生产构建。用户已要求构建或排查构建失败时无需再次确认；先检查构建脚本的副作用，优先使用隔离输出目录。若必须中断用户正在使用的开发服务或影响生产环境，再确认。构建授权不包含发布授权。
- Use `npx tsc --noEmit` for TypeScript validation by default.
- 若构建与开发服务会共用 `.next`，优先隔离构建输出。确需中断正在使用的开发服务时先确认；获得授权后停止服务，构建完成后仅清理本项目可再生的 `.next` 输出并重启开发服务，再检查 localhost。保留其他文件和进程。
- The dev server can show stale Webpack chunk errors when `.next` mixes dev and production output.
