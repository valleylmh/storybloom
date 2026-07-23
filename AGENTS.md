# StoryBloom Agent Notes

- During UI/dev iteration, do not run `npm run build` unless the user explicitly asks for a production build.
- Use `npx tsc --noEmit` for TypeScript validation by default.
- If a production build is truly needed while a dev server is running, stop the dev server first. After the build, clean `.next` and restart `npm run dev` before checking `localhost:3000`.
- The dev server can show stale Webpack chunk errors when `.next` mixes dev and production output.
