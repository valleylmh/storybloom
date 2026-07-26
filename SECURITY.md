# Security Policy

## Reporting a vulnerability

Please do not publish exploitable details in a public issue. Use the repository's private GitHub Security Advisory flow and include:

- the affected route or file;
- reproduction steps and expected impact;
- any suggested mitigation;
- whether the issue is already being exploited.

Please avoid testing against production data, downloading user content, or accessing accounts you do not own. Maintainers will acknowledge a complete report as soon as practical and coordinate disclosure after a fix is available.

## Supported version

Security fixes are applied to the latest version on the default branch. Self-hosted deployments are responsible for updating dependencies, protecting environment variables, configuring rate limiting, and keeping Supabase policies and storage buckets private where documented.

## Child data and self-hosting baseline

- Keep `SUPABASE_SERVICE_ROLE_KEY`, provider credentials, webhook secrets and cron secrets on the server. Never expose them through `NEXT_PUBLIC_*` variables.
- Apply the documented Supabase migrations before enabling family characters, narration audio or public story sharing. The family photo and narration buckets are private; the share-image bucket is public by design because shared reading pages are public.
- Keep Turnstile and rate limits enabled on public generation endpoints, especially routes that can consume model or audio resources.
- Do not add server-side fetching of arbitrary user-provided URLs without an allowlist, redirect validation and private-network protections.
- Treat names, photos, family details, narration and generated books as private unless a parent explicitly creates a public share.
- If you add long-term reading or growth records, ship visibility, export, retention controls and deletion at the same time. Do not infer or store hidden psychological, emotional or ability scores for children.
