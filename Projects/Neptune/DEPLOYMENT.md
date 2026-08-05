# Neptune Deployment and Domain Setup

This repository now serves Neptune as a static Vercel site under:

- https://neptune.atipicgroup.com

## 1. Deploy to Vercel

1. Import this repository into Vercel.
2. Set the project domain to `neptune.atipicgroup.com`.
3. Mark `neptune.atipicgroup.com` as the primary domain.
4. Deploy the Vercel project.

## 2. Connect custom domain

1. In Vercel project settings, add domain: `neptune.atipicgroup.com`.
2. In DNS for `atipicgroup.com`, add a single CNAME record:
   - host: `neptune`
   - value: `cname.vercel-dns.com`
3. Do not create an A record for the `neptune` host.
4. Wait for SSL certificate issuance (automatic in Vercel).
5. Confirm the domain in Vercel shows as the canonical public URL.

## 3. Update website links

Update external links to Neptune so they point to:

- https://neptune.atipicgroup.com

If your site currently links to placeholder URLs, replace those references in the website source.

The public Neptune landing page should point users directly to the canonical subdomain:

- `https://neptune.atipicgroup.com`

## 4. App source note

The legacy analytical source is kept in the repository for reference, but it is no longer the public delivery layer.

## 5. Admin access

The fallback admin login remains available in the legacy source for internal review only.

Default fallback values (change in production if you ever re-enable them):

- Username: `admin@neptune.local` or `admin`
- Password: `NeptuneAdmin2026!`
