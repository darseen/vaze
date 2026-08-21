# Vaze Docs

The documentation site for [Vaze](https://github.com/darseen/vaze), built
with [Next.js](https://nextjs.org) and [Fumadocs](https://fumadocs.dev).

## Development

From the repository root:

```bash
pnpm install
pnpm dev --filter=docs
```

The site runs at http://localhost:3001.

## Writing docs

Content lives in [`content/docs`](./content/docs) as MDX files. Each folder
has a `meta.json` controlling sidebar order and icons. See the
[Fumadocs documentation](https://fumadocs.dev/docs/ui) for available MDX
components (`Callout`, `Cards`, `Tabs`, ...).

Notable routes:

- `/docs` — the documentation pages.
- `/api/search` — full-text search endpoint (Orama), used by the search
  dialog.
- `/llms.txt`, `/llms-full.txt`, and per-page `.md` variants — markdown
  exports for LLM consumption.
- `/og/docs/...` — auto-generated Open Graph images.
- `/sitemap.xml` and `/robots.txt`, generated from the content source.

## Deploying

Set `NEXT_PUBLIC_SITE_URL` to the public origin of the site (for example
`https://vaze.dev`). It is read at build time and feeds canonical URLs, Open
Graph image URLs, `sitemap.xml`, and `robots.txt`. It defaults to
`http://localhost:3001`, so leaving it unset on a real deployment leaves those
URLs pointing at localhost. See `.env.example`.
