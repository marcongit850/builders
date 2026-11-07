# Walton County Builders Network

Design preview of the homepage. This Worker serves one static page plus its fonts, stylesheet, and logo. It does not include membership, login, news, a calendar, an issues tracker, or a member directory.

The page keeps Marc’s concept copy and the approved layout. The mark is the square navy logo, shown in full. It is not cropped into a circle.

## Preview locally

```bash
npm install
npm run dev
```

## Deploy the preview worker

The Wrangler name is `builders-preview`. Deploy only that worker:

```bash
npx wrangler deploy
```

Expected preview URL: `https://builders-preview.352marc.workers.dev`

Do not attach a custom domain. Do not deploy this project under another worker name. Do not merge the preview pull request onto a live site.
