# Walton County Builders Network

The site at https://waltonbuildersnetwork.org and www.waltonbuildersnetwork.org is the Cloudflare Worker `builders-preview`. www redirects to the apex host. CSS, fonts, and images are loaded from the pinned GitHub commit in `src/index.js`.

## Deploy

There is no Workers Builds trigger and no GitHub Action. Merging to `main` does not publish the site.

After review, deploy this same worker by hand:

```bash
npx wrangler deploy
```

That upload updates `builders-preview`. The custom domains are already attached, so do not add a new route or a second worker name.
