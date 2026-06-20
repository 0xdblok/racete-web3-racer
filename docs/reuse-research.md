# Reuse Research

Current milestone: wallet/player/garage foundation.

## anza-xyz/wallet-adapter
- Stack: TypeScript, Solana wallet adapter packages.
- Useful parts: Wallet provider/modal patterns for Phantom, Solflare, Backpack-compatible adapters.
- Problems: Some wallet packages have noisy/deprecated transitive dependencies; Backpack needs its dedicated adapter package.
- License: Apache-2.0.
- Decision: Copy/adapt provider pattern only.

## supabase/supabase
- Stack: TypeScript/Postgres platform examples and client packages.
- Useful parts: `@supabase/supabase-js` server client with service role for trusted backend writes.
- Problems: Full repo is huge and not a starter app for this game.
- License: Apache-2.0.
- Decision: Use official client package and patterns, not repo code.

## vercel/next.js
- Stack: Next.js App Router.
- Useful parts: App Router route handlers and project scaffold.
- Problems: Next 16/Turbopack rules differ from older examples; used generated project docs/rules.
- License: MIT.
- Decision: Use `create-next-app` scaffold as base.
