# Tiplyfi

Creator tipping on Arc. A fan opens a creator page, sends USDC, and it lands in
the creator's own wallet in the same transaction.

Live on Arc Testnet. The contract lives in
[tiplyfi-contracts](https://github.com/Weself-ux/tiplyfi-contracts).

## Stack

React Router v7 on Vercel, Neon Postgres, Circle User-Controlled Wallets,
Tailwind.

## How it works

**Creators** sign in with Google. Circle creates a user-controlled wallet tied
to that identity - no password, no seed phrase, and we never hold the keys. The
session token sits in an httpOnly cookie.

**Fans** do not sign in. They open a tip page, connect any wallet, approve one
transaction, and leave.

**Tips** go through `TipRouter` on chain rather than through us. The creator's
cut and the platform fee settle in the same transaction. Nothing sits in a
platform balance waiting for a payout run, because there is no platform
balance.

**The database is a mirror, not the source of truth.** A cron job reads
`Tipped` and `TipEscrowed` logs from the router and writes rows. If it falls
behind, the money is still exactly where it should be - the chain is the
ledger.

## Surfaces

- `/` - landing
- `/:username` - public creator profile
- `/tip/:username` - the tip page, the only page a fan needs
- `/dashboard` - creator earnings, withdrawals, engagement
- `/settings` - profile, payout, account

## Running it

```
bun install
bun run dev
```

Environment variables, values not included:

| Name | What it is |
| --- | --- |
| `DATABASE_URL` | Neon connection string |
| `CIRCLE_API_KEY` | Circle server key, server side only |
| `NEXT_PUBLIC_CIRCLE_APP_ID` | Circle App ID, entity scoped |
| `NEXT_PUBLIC_GOOGLE_AUTH_CLIENT_ID` | Google OAuth client |
| `ARC_RPC_URL` | Arc RPC endpoint |
| `TIP_ROUTER_ADDRESS` | router address, server side |
| `VITE_TIP_ROUTER_ADDRESS` | router address, client side |
| `CRON_SECRET` | shared secret for the indexer cron |

## Things that will bite you

- **Routes are not auto-discovered.** React Router v7 needs every route listed
  in `src/app/routes.ts`. A file that exists but is not listed 404s.
- **GET is `loader`, POST is `action`.** Exporting `GET` or `POST` by name
  returns 400 with no server logs at all.
- **Amounts are `BigInt` end to end.** USDC on Arc is native at 18 decimals and
  ERC-20 at 6, sharing one balance. A one cent tip is `1e16` in native units,
  already past `Number.MAX_SAFE_INTEGER`.
- **The indexer filters on the ERC-20 emitter only.** Every USDC movement emits
  two `Transfer` logs. Filter wrong and every tip counts twice.
- **`recharts` must never reach the SSR bundle.** Lazy load it.

## License

Not open source. All rights reserved.
