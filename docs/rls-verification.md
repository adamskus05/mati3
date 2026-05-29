# RLS-verifiering

Kör dessa steg efter `supabase db push` med två testanvändare (A och B).

## Förberedelse

1. Skapa användare A och B via appens registrering.
2. A skapar hushåll H1. B skapar hushåll H2.
3. A delar inbjudningskod; B går med i H1.

## Tester

| Test | Förväntat resultat |
|------|-------------------|
| A listar kategorier i H1 | Ser data |
| B (ej medlem i H2) listar A:s H1-data via REST med B:s JWT och `household_id` från H1 | 0 rader eller RLS-fel |
| A skapar lista i H1, B ser den i realtid (två flikar) | B ser uppdatering utan reload |
| A markerar en vara som köpt | Endast den varan flyttas ned i sin kategori |
| A tar bort lista, skapar ny med samma namn | Ny lista har inga varor |
| A arkiverar lista | Syns under Historik, read-only |

## SQL (service role – endast lokal debug)

```sql
-- Bekräfta RLS är på
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename IN (
  'profiles', 'households', 'household_members', 'categories',
  'shopping_lists', 'shopping_items', 'item_presets'
);
```

Alla ska ha `rowsecurity = true`.
