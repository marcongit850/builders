# Walton County Builders Network

Design preview of the homepage and a membership application page. It does not include login, an admin area, news, a calendar, an issues tracker, or a member directory.

Contact messages and membership applications are emailed with the Workers `EMAIL` binding (`send_email`). The binding can send only to `destination_address = "marc@whpinc.com"`. Reply-To is the address the person entered. The from address is `builders-network@whpinc.com` (`EMAIL_FROM` in `wrangler.toml`). That sender must already belong to a domain onboarded to Cloudflare Email Service. This project does not enable Email Routing and does not change MX records. If the from address is not authorized, the form shows an error instead of a thank-you page.

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
