# paid-funnel-simple-form-funnel

Astro 7 paid funnel for **Shape A**: simple ZIP opt-in → contact capture → **thank-you page with 5 inventory product slots**.

## Flow

1. **ZIP** — clean card opt-in
2. **Contact** — lead capture → GHL delivery
3. **Thank you** — conversion fires + **5-slot inventory grid** (active products only)

## Local preview

```bash
npm install
npm run dev
```

Open: `http://localhost:4321/lp/hot-tub-offer/step/1`

Complete contact to land on thank-you inventory.

## Configure inventory (5 slots)

Edit `funnel.config.ts`:

```ts
inventory: {
  enabled: true,
  headline: "Active inventory near you",
  subheadline: "...",
  pageUrl: "https://client.com/inventory", // optional link below grid
  products: [ /* exactly 5 entries */ ],
}
```

Each product slot:

```ts
{
  id: "serenity-6",
  name: "Serenity 6-Person Hot Tub",
  imageUrl: "https://...",
  priceLabel: "From $8,499",
  ctaLabel: "View details",
  ctaUrl: "https://client.com/inventory/serenity-6",
  active: true, // false = slot hidden
}
```

Schema requires **exactly 5** products. At least one must be `active: true`.

## Deploy

```bash
npm run build
npm run deploy
```

Owner approval required for production wrangler deploy.

## Wiring checklist

Full go-live checklist (secrets, Meta, GHL, callbacks, what's N/A vs Lead Vault):

**[docs/WIRING.md](./docs/WIRING.md)**
