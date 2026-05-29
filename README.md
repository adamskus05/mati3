# Mati

Progressive Web App för gemensamma inköpslistor inom hushåll. Byggd med Next.js 15, Supabase och Vercel.

## Funktioner

- E-post/lösenord-autentisering med persistent session
- Hushåll med inbjudningskod, medlemmar och realtidssynk
- Kategorier med färg, sortering och säker borttagning
- Inköpslistor med mjuk radering och historik (read-only)
- Varor med per-item köpt-markering, sök, drag-and-drop
- Snabbknappar per hushåll
- PWA: installerbar, offline-läsning av cachad data, dark/light mode

## Kom igång

### 1. Supabase

1. Skapa ett projekt på [supabase.com](https://supabase.com) (rekommenderat: EU-region).
2. Kopiera URL och anon key till `.env.local`:

```bash
cp .env.example .env.local
```

3. Kör migrationer:

```bash
npx supabase link --project-ref YOUR_REF
npm run db:push
```

4. Under **Authentication → URL configuration**, lägg till:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`

### 2. Lokal utveckling

```bash
npm install
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000).

### 3. Vercel

1. Importera repot till Vercel.
2. Lägg till `NEXT_PUBLIC_SUPABASE_URL` och `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Uppdatera Supabase redirect URLs med din produktionsdomän.

## PWA på mobil

- **Android:** Chrome → menyn → "Lägg till på startskärmen"
- **iOS:** Safari → Dela → "Lägg till på hemskärmen"

Service worker är inaktiverad i `development`; testa install med `npm run build && npm start`.

## Säkerhet

Alla tabeller har Row Level Security. Användare ser endast data för hushåll de är medlemmar i. Kör `supabase db advisors` efter schemaändringar.

## Projektstruktur

```
src/app/          # Next.js App Router
src/components/   # UI och domänkomponenter
src/lib/          # Supabase, queries, validators
supabase/migrations/
```
