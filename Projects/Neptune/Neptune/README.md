# Neptune Water Intelligence Platform

Industrial water management & sustainability investment decision support.
Legacy analytical source retained for reference. Demo case: Bremen Steel Works.

## Legacy source

The historical analytical code remains in the repository for reference, but it is no longer the public runtime. The live Neptune site is the Vercel deployment at `https://neptune.atipicgroup.com`.

## Pages

| Page | Purpose |
|---|---|
| Country & Region | Water stress map, regulatory discharge limits by country |
| Company Data | Water flow balance, source breakdown, contaminant concentrations |
| Flow Diagram | Sankey water flow diagram with contaminant concentrations |
| Treatment Solutions | Technology selection, contaminant removal chain, compliance check |
| Cost Estimation | SAP-coded cost library, import/export |
| EBITDA Bridge | Value creation waterfall chart |
| CapEx / OpEx | Multi-year investment plan, NPV, IRR, optimisation |

## Deployment — Vercel Static Site

Neptune is now published directly as a static site at `https://neptune.atipicgroup.com`.

1. Import this repository into Vercel.
2. Set `neptune.atipicgroup.com` as the primary domain.
3. Add DNS `CNAME neptune -> cname.vercel-dns.com`.
4. Deploy the project.

See root-level [DEPLOYMENT.md](../DEPLOYMENT.md) for full steps.

## Login

The legacy analytical source supports two login paths:

- Database users from `neptune_users` (Neon/Postgres)
- Fallback admin user via environment variables

Fallback admin defaults (change in production if ever re-enabled):

- Username: `admin@neptune.local` (or `admin`)
- Password: `NeptuneAdmin2026!`

## Requirements

- Python 3.10+
- See requirements.txt
