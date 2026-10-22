# YZ SKU Admin

A small admin web app for managing product SKUs, each with its own permanent QR code.

- **Products** — every SKU at a glance (grid or list), with search, type filter, status filter, sorting and stock stats. Select products to print a sheet of QR labels.
- **Types** — products organised by type (Pearls, Jade, …) with SKU count, units and stock value per type. Each type has its own SKU prefix (e.g. `PRL-0001`, `JAD-0001`).
- **Scan** — scan a product's QR code with the phone camera (or from a photo, or by typing the SKU) to see it instantly and adjust stock with +/−.
- **Product page** — photo, details, quick stock adjust, QR code (download PNG / print), full change history.
- **Settings** — CSV import/export, print all labels, change password.

## How the QR codes work

Each QR code holds a link like `https://leeyazi.github.io/YZ-SKU/#/p/PRL-0001`. The link only contains the SKU, so you can edit any product details (price, stock, photo…) without reprinting the label. SKUs can't be changed after creation for this reason.

## Hosting (GitHub Pages)

It's a static site — no build step.

1. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, folder `/ (root)`.
2. The site appears at `https://leeyazi.github.io/YZ-SKU/` after a minute.

If you host it elsewhere, change `QR_BASE_URL` in `config.js` **before** printing labels.

## Backend (Supabase)

Data lives in the Supabase project **COMPANY APP** (`xbjjmfdmdcdsyplhgqus`):

| Table | Purpose |
|---|---|
| `sku_products` | One row per SKU |
| `sku_types` | Product types + SKU prefix + colour |
| `sku_history` | Change log, written automatically by a database trigger |
| `sku_admins` | Emails allowed to use the app |
| storage bucket `sku-images` | Product photos (private) |

Row-level security only lets signed-in users whose email is in `sku_admins` read or write anything. The key in `config.js` is the publishable key, which is safe to be public.

**Add another admin:** create the user in Supabase (Authentication → Users → Add user), then run
```sql
insert into public.sku_admins(email) values ('person@example.com');
```

## Files

- `index.html` — page shell
- `styles.css` — styles (light + dark mode, mobile bottom tab bar)
- `app.js` — the app (vanilla JS, hash routing)
- `config.js` — Supabase URL/key, QR base link, currency
