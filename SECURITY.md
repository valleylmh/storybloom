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
