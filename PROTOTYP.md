# Prototyp: Beirat dabei mit Payload CMS

Stand 03.11.2026. Ziel: prüfen, ob Payload (MIT) Directus ersetzen kann.

## Starten

```bash
corepack pnpm@9.15.9 install
corepack pnpm@9.15.9 --filter @beirat-dabei/core build
corepack pnpm@9.15.9 --filter @beirat-dabei/handlers build
cp app/.env.example app/.env        # Werte setzen
cd app && corepack pnpm@9.15.9 dev   # http://localhost:3000/admin
```

Die erste Person, die sich unter `/admin` registriert, wird das technische Administratorkonto (`superadmin`).

## Was geht (geprüft)

- Pakete `core` (75 Tests), `ris-adapter` (25), `handlers` (54: Handler, Mail, Regellauf, Abgleich, öffentliche Seiten) und `dashboard` (7) laufen unverändert bzw. mit kleinen Anpassungen.
- Datenmodell, Rollen `superadmin` / `admin` / `mitglied` und Zugriffsregeln als Code (`app/src/access.ts`, `app/src/collections/`). `admin` kann sich nicht hochstufen und keine Benutzer anlegen oder ändern.
- Endpoints unter `/beirat-dabei/...`: Dashboard, Teilnahme, Notiz, Abo, iCal, Magic Links, öffentliche Seiten, Dateien.
- Regellauf und RIS-Abgleich als Zeitpläne (`app/src/laeufe.ts`, croner) mit Modi aus/trocken/scharf; Regellauf auch kurz nach Änderungen an Teilnahmen.
- Dashboard mit Payload-Anmeldung, „Passwort vergessen“ mit Link ins Dashboard (`passwort.html`).
- Konto sperren, Sperre nach 5 Fehlversuchen, deutsche Oberfläche, Migrationen im Produktionsbetrieb.
- `docker compose up` mit Anwendung und Caddy getestet: Migration, Erstregistrierung, Anmeldung im Browser, Passwort-Reset, Link bestätigen, Regellauf im Trockenmodus. Speicherbedarf der Anwendung rund 220 MB.

## Noch offen

- `instanz.yaml` und `instanz-anwenden.mjs` (Paket `instanz`) für Payload neu bauen. Bis dahin: Einstellungen in der Verwaltung pflegen.
- Alle Dokumente neu schreiben: README, Betrieb, installation, Konzept, SECURITY.md (Stand dort noch Directus). Die alten liegen in `../beirat-dabei.directus/docs`.
- Backup-Skripte (`backup.sh`, `restore.sh`) auf `data/beirat.db` und `data/uploads` umstellen.
- Mailversand gegen einen echten SMTP-Server und RIS-Abgleich gegen das echte RIS testen; Vorlagen für Impressum und Datenschutz beim ersten Start eintragen.
- Rate-Limit am Proxy, Playwright-/Browser-Tests, Node-Version `^22.23.4` auf dem Server.
