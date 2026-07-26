# Contributing to StoryBloom

Thanks for helping improve StoryBloom.

Before proposing a larger product feature, read [ROADMAP.md](ROADMAP.md). Planned growth features must remain parent-controlled, optional, visible, exportable, and deletable; do not add hidden child scoring or diagnostic labels.

## Local setup

1. Install Node.js 20 or newer and pnpm.
2. Run `pnpm install`.
3. Copy `.env.example` to `.env.local` and add only the providers you want to test.
4. Run `pnpm dev` and open `http://localhost:3000`.

The basic story flow works without provider keys by using local fallback text and demo images. Never commit `.env*`, production credentials, private child photos, customer books, contact QR codes, or local `.storybloom-cache` data.

## Before opening a pull request

Run:

```bash
npx tsc --noEmit
pnpm test
```

Keep changes focused, add tests for behavior changes, and document new environment variables in both `.env.example` and `README.md`. Do not run or commit a production build as part of routine UI iteration.

## Product and privacy expectations

- Treat children's names, photos, family details, narration, and generated books as private data.
- Keep service credentials on the server and out of `NEXT_PUBLIC_*` variables.
- Do not add user-controlled server-side URL fetching without an explicit allowlist and private-network protections.
- Preserve the no-key local fallback so contributors can run the project safely.
- Check third-party licenses before adding models, media, fonts, or large generated assets.
