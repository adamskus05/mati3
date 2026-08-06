# Push-notiser – verifiering

## Förutsättningar

- Edge Function `push-send` deployad med `--no-verify-jwt`
- Secrets: `PUSH_WEBHOOK_SECRET`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`
- Database Webhook konfigurerad (se [edge-functions.md](./edge-functions.md))
- Produktion eller `npm run build && npm start` (service worker + push kräver HTTPS i praktiken)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` i build-miljön

## Database Webhook

| Fält | Värde |
|------|--------|
| Name | `household_events_push` |
| Table | `household_events` |
| Events | **Insert** |
| URL | `https://chfarvaiabixaxcylhhr.supabase.co/functions/v1/push-send` |
| Header | `x-push-secret: <PUSH_WEBHOOK_SECRET>` |
| Timeout | 5000 ms |

`/api/push/send` är en fallback-proxy; primär väg är Edge direkt.

## curl-test (utan webhook)

Ersätt `SECRET`, `HOUSEHOLD_ID` och `USER_ID` (användare som **inte** ska få notisen – oftast aktören):

```bash
curl -sS -X POST \
  "https://chfarvaiabixaxcylhhr.supabase.co/functions/v1/push-send" \
  -H "Content-Type: application/json" \
  -H "x-push-secret: SECRET" \
  -d '{
    "householdId": "HOUSEHOLD_ID",
    "eventType": "member_joined",
    "title": "Mati",
    "body": "Test",
    "url": "/h/HOUSEHOLD_ID",
    "excludeUserId": "USER_ID"
  }'
```

Förväntat: `{"sent":N,"eventType":"member_joined"}` med `N > 0` om det finns prenumerationer.

Fel secret → `403`.

## SQL – prenumerationer

```sql
SELECT user_id, left(endpoint, 60) AS endpoint, created_at
FROM public.push_subscriptions
ORDER BY created_at DESC;
```

## End-to-end-checklista

1. **Två konton** i samma hushåll (A och B).
2. **B** aktiverar push under Inställningar (PWA installerad, notisbehörighet tillåten).
3. Bekräfta rad i `push_subscriptions` för B.
4. **A** triggar en händelse som loggas och skickar push:
   - `member_joined` – A går med via inbjudningskod (övriga får push, inte A).
   - `shopping_started` – A trycker “Jag handlar” på en lista (övriga får push, inte A).
5. **B** får notis med titel “Mati”, svensk brödtext, klick öppnar `/h/{householdId}`.
6. Supabase Dashboard → Edge Functions → `push-send` → loggar visar `sent > 0`.

## Eventtyper som skickar push

| Källa | När | Hur |
|-------|-----|-----|
| App → Edge (`push-send` + JWT) | Partner lägger till vara / börjar eller slutar handla | Primär väg för par-vardag |
| Database Webhook → Edge | `member_joined` | Valfri; övriga eventtyper hoppas över (`skipped`) |

Aktivera push under Inställningar i den installerade PWA:n. Båda i hushållet behöver ha push på.

## Felsökning

| Symptom | Kontroll |
|---------|----------|
| Ingen notis | Webhook finns? Secret matchar? B har prenumeration? |
| 403 i Edge-logg | `x-push-secret` fel |
| 400 `"Missing fields"` | Rad i `household_events` med okänd `event_type` (webhook triggas ändå) |
| `sent: 0` | Inga prenumerationer för andra medlemmar i hushållet |
| Fungerar inte lokalt | Använd produktions-URL + `npm start`; dev har ofta ingen SW |

## RLS

`push_subscriptions` tillåter SELECT/INSERT/DELETE för egen `user_id`. Vid problem med re-subscribe på samma endpoint, kontrollera att upsert inte kräver UPDATE-policy.
