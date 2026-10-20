# Beirat dabei

Sitzungsbegleitung für Beiräte und Initiativen, die die Ausschüsse ihrer Kommune verfolgen: Termine im Blick behalten, Teilnahme abstimmen, Ergebnisse festhalten.

> **Status:** Konzeptphase. Der Aufbau des Repos ist geplant, der Code entsteht schrittweise. Erste Instanz ist der Umweltbeirat Kremmen.

## Worum es geht

Ein Beirat möchte bei den Sitzungen bestimmter Ausschüsse mit mindestens einem Mitglied vertreten sein. *Beirat dabei* übernimmt die Abstimmung dafür:

- **Dashboard** mit allen Sitzungsterminen, Link zur Tagesordnung, Teilnehmenden und Ergebnissen
- **Ein-Klick-Teilnahme** über Magic Links per E-Mail, ohne Anmeldung
- **Kurznotiz** nach der Sitzung mit einstellbaren Fragen
- **Automatische Benachrichtigungen** nach festen Regeln mit einstellbaren Fristen
- **Kalender-Abo** (iCal) für den eigenen Kalender

Termine und Tagesordnungen kommen über einen Adapter aus dem Ratsinformationssystem (RIS) der Kommune.

## Für wen

Für jedes Gremium, das öffentliche Ausschusssitzungen begleiten will, zum Beispiel Umwelt-, Senioren-, Jugend- oder Behindertenbeiräte, Ortsbeiräte oder Bürgerinitiativen. Jede Gruppe betreibt ihre eigene Instanz.

## Kern und Instanz

| Allgemein (Kern) | Pro Instanz einstellbar |
| --- | --- |
| Dashboard, Teilnahme, Magic Links, iCal | Name, Logo, Farben, Absender, Domain |
| Regel-Engine für Benachrichtigungen | Fristen vor und nach der Sitzung |
| Kurznotiz | Fragen im Notizformular |
| Datenmodell mit Gremien | begleitete Gremien |
| Rollenmodell Mitglied/Admin | Rollennamen |
| Schnittstelle für RIS-Adapter | Adapter und Quelle |
| KI-Vorsortierung (optional) | Themenfokus |

Eine vollständige Beispielkonfiguration liegt unter [`examples/kremmen/`](examples/kremmen/).

## Benachrichtigungsregeln

| # | Auslöser | Bedingung | Empfänger |
| --- | --- | --- | --- |
| 1 | Tagesordnung veröffentlicht | – | alle Mitglieder |
| 2 | Jemand trägt sich ein | – | alle anderen Mitglieder |
| 3 | *n* Tage vor der Sitzung (Standard: 7) | niemand eingetragen | alle Mitglieder |
| 4 | Letzte Person trägt sich aus | innerhalb dieser Frist | alle Mitglieder |
| 5 | *m* Tage nach der Sitzung (Standard: 3) | keine Notiz vorhanden | die Teilnehmenden |

Die Regeln werden einmal täglich um 7 Uhr geprüft, außerdem kurz nach jeder Änderung an einer Teilnahme. Ein Versandprotokoll verhindert doppelte Nachrichten. Schlägt ein Versand fehl, wird er beim nächsten Lauf wiederholt.

`REGELN_MODUS` steuert den Versand: `aus`, `trocken` (nur ins Log schreiben, Standard) oder `scharf`. Erst auf `scharf` stellen, wenn die Sitzungen im System stimmen, sonst gehen beim ersten Lauf Mails zu allem Bestehenden raus. Sitzungen, die mehr als 60 Tage zurückliegen, werden nicht mehr bewertet.

Links in Mails gelten bis zum Sitzungsende plus 14 Tage (`MAGIC_LINK_NACHLAUF_TAGE`, `SITZUNGSDAUER_STUNDEN`). Der Rückgängig-Link nach einem Klick gilt 30 Minuten. Die Mails verweisen auf `DASHBOARD_URL/link.html?token=…`. Die Seite zeigt eine Bestätigung, erst der Knopf führt die Aktion aus, danach gibt es „Rückgängig machen“.

## RIS-Adapter

Der Kern spricht nur mit einer kleinen Schnittstelle: Sitzungen eines Gremiums abrufen und die Tagesordnung einer Sitzung abrufen. Dahinter stehen austauschbare Adapter:

| Adapter | Wann | Status |
| --- | --- | --- |
| `komfa` | [KOMFA RIS](https://www.komfa.de): Monatskalender, iCal je Sitzung und Tagesordnungsseite | umgesetzt (Kremmen) |
| OParl | das RIS bietet den offenen [OParl-Standard](https://oparl.org) | geplant |
| iCal / RSS | das RIS liefert nur Feeds | geplant |
| Scraper für andere Produkte | z. B. SessionNet oder ALLRIS | nach Bedarf |
| `manuell` | Termine werden von Hand in Directus gepflegt, kein Abgleich | umgesetzt |

Gebaut wird zuerst, was die erste Instanz braucht. Weitere Adapter sind als Beitrag willkommen.

**Abgleich.** Dreimal täglich (`RIS_CRON`) werden die Sitzungen der aktiven Gremien mit dem RIS verglichen, von 7 Tagen zurück bis 90 Tage voraus. Erkannt werden neue Sitzungen, Verschiebungen, Orts- und Absageänderungen sowie das Erscheinen einer Tagesordnung. Eine kommende Sitzung, die bei vollständigem Abruf im RIS fehlt, gilt als abgesagt. Zurückgenommen wird nichts automatisch. Wie bei den Regeln steuert `RIS_MODUS` (`aus`, `trocken`, `scharf`) den Betrieb. Der Adapter nutzt einen erkennbaren User-Agent, pausiert zwischen den Abrufen und ruft die Tagesordnung nur ab, solange sie noch nicht als veröffentlicht gilt.

**Einrichten für KOMFA:** In den Einstellungen `ris_adapter` auf `komfa` und `ris_quelle` auf die Adresse des RIS setzen (z. B. `https://ris-kremmen.komfa.de`). Bei jedem Gremium `ris_kennung` auf den Namen setzen, wie ihn das RIS anzeigt (z. B. `Bau-/Wirtschafts- und Umweltausschuss`).

## Architektur

```
RIS der Kommune ──▶ RIS-Adapter ──▶ Directus + SQLite ──▶ Dashboard (Browser)
                                         │
                          ┌──────────────┴──────────────┐
                          ▼                             ▼
                  Extension                      Regeln (Hook)
            Magic Links, iCal-Feed                      │
                  ▲        │                            ▼
                  │        ▼                      E-Mail / Push
                  │   Kalender-Abo                      │
                  └──── Klick auf Magic Link ───────────┘
```

| Baustein | Aufgabe |
| --- | --- |
| [Directus](https://directus.io) | Datenmodell, Rollen, Admin-Oberfläche, API |
| SQLite | Datenbank als eine Datei im Volume |
| Directus-Extension | Magic Links, iCal-Feed und Cron-Hooks für Regeln und RIS-Abgleich |
| `packages/core` | Fristen, Regeln, Token, iCal als reine, getestete Funktionen |
| `packages/ris-adapter` | holt Termine und Tagesordnungen |
| Dashboard | schlanke statische Seite gegen die Directus-API |

Jede Instanz läuft als eigener Docker-Compose-Stack und lässt sich durch Kopieren von Konfiguration und Datenbankdatei auf einen anderen Server umziehen. Eine gemeinsame Plattform für mehrere Beiräte ist bewusst nicht vorgesehen.

## Geplanter Aufbau

TypeScript-Monorepo mit pnpm-Workspaces. Die Logik liegt in `packages/` und kennt Directus nicht, die Extensions sind nur die Anbindung.

```
beirat-dabei/
├── docker-compose.yml
├── .env.example
├── package.json                 # pnpm-Workspaces
├── pnpm-workspace.yaml
├── packages/
│   ├── core/                    # Regeln, Fristen, Magic-Link-Token, iCal
│   └── ris-adapter/             # Schnittstelle, KOMFA-Adapter, Abgleich
├── directus/
│   └── extensions/beirat-dabei/ # Bundle: Endpoints (Dashboard-API, Magic Link, iCal),
│                                # Hooks (Regeln mit Mailversand, RIS-Abgleich)
├── dashboard/                   # statisches Frontend (HTML, CSS, ES-Module)
├── Caddyfile                    # Dashboard und Directus unter einer Adresse
├── examples/
│   └── kremmen/                 # instanz.yaml, .env.example, Branding
├── scripts/
│   ├── schema-anwenden.mjs      # Datenmodell, Rollen, Rechte → Directus
│   ├── dev-proxy.mjs            # Dashboard + Directus lokal unter einer Adresse
│   ├── instanz-anwenden.sh      # instanz.yaml → Directus
│   ├── backup.sh
│   └── restore.sh
├── docs/                        # Konzept, Betrieb, neue Instanz, Adapter schreiben
└── .github/workflows/ci.yml     # Lint, Tests, Build
```

Die Benachrichtigungsregeln sind bewusst Code und keine Directus-Flows: So sind sie versioniert, reviewbar und per Unit-Test abgedeckt.

## Eigene Instanz aufsetzen

> Wird ergänzt, sobald der Stack lauffähig ist.

```bash
git clone https://github.com/<owner>/beirat-dabei.git
cd beirat-dabei
cp .env.example .env    # Werte eintragen, siehe unten
docker compose up -d
```

Danach die Instanz konfigurieren: `examples/kremmen/instanz.yaml` kopieren, anpassen (Name, Gremien, Fristen, Notizfragen, Rollennamen, RIS-Adapter) und mit `scripts/instanz-anwenden.sh` übertragen. Spätere Änderungen erfolgen in der Admin-Oberfläche.

Wichtige Werte in `.env`:

| Variable | Bedeutung |
| --- | --- |
| `PUBLIC_URL` | öffentliche Adresse der Instanz |
| `KEY`, `SECRET` | Directus-Schlüssel, zufällig erzeugen |
| `DB_CLIENT=sqlite3`, `DB_FILENAME` | Datenbank |
| `EMAIL_*` | SMTP-Zugang für den Versand |
| `MAGIC_LINK_SECRET` | Schlüssel zum Signieren der Magic Links |
| `TZ=Europe/Berlin` | Zeitzone für die Fristen |

Die Extension muss einmal gebaut werden, bevor der Stack startet:

```bash
pnpm install
pnpm -r build
```

Danach das Datenmodell anlegen: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DIRECTUS_URL` und die Rollennamen aus der `.env` setzen und `node scripts/schema-anwenden.mjs` ausführen.

**Keine echten Werte committen.** Die `.env` steht in `.gitignore`.

## Dashboard

Eine statische Seite ohne Framework unter `dashboard/` (`index.html` für Mitglieder, `link.html` für Magic Links). Der Stack enthält einen Caddy-Dienst (`Caddyfile`), der unter einer Adresse das Dashboard auf `/dashboard/` ausliefert und alles andere an Directus weiterreicht. Die Anmeldung nutzt den Directus-Login mit Sitzungs-Cookie. Die Seite kann also ohne Cross-Origin-Einstellungen mit der API sprechen.

Zur Entwicklung gegen einen lokalen Directus:

```bash
DIRECTUS_URL=http://localhost:8055 PORT=8056 pnpm dev:dashboard
# http://localhost:8056/dashboard/
```

Lokal über http muss `SESSION_COOKIE_SECURE=false` gesetzt sein.

## Schnittstelle der Extension

Alle Pfade unter `/beirat-dabei`. Mitglieder greifen nie direkt auf Daten zu, die Extension prüft die Rechte im Code.

| Pfad | Zugang | Zweck |
| --- | --- | --- |
| `GET /dashboard` | Directus-Anmeldung | kommende und vergangene Sitzungen, Teilnehmende (nur Namen), Notizfragen |
| `POST /teilnahme` | Directus-Anmeldung | `{sitzung, aktion}` mit `eintragen`, `austragen`, `nicht-teilgenommen` |
| `POST /notiz` | Directus-Anmeldung | `{sitzung, relevant, antworten}`, nur für Teilnehmende nach der Sitzung |
| `GET /link/:token` | Magic Link | Angaben für die Bestätigungsseite, ändert nichts |
| `POST /link/:token` | Magic Link | führt die Aktion aus, liefert einen Rückgängig-Link |

## Rollen

| Rolle | Rechte |
| --- | --- |
| Mitglied | Dashboard sehen, sich ein- und austragen, Notizen schreiben |
| Admin | zusätzlich Mitglieder, Gremien, Sitzungen und Einstellungen verwalten |

Die Rollennamen sind je Instanz frei wählbar.

## Betrieb

- **Konfiguration als Code:** Datenmodell, Rollen und Berechtigungen legt `scripts/schema-anwenden.mjs` idempotent in Directus an. Das Skript liegt im Repo und lässt sich beliebig oft ausführen.
- **Backup:** `scripts/backup.sh` sichert die SQLite-Datei per `sqlite3 .backup` (auch bei laufendem Betrieb konsistent) und die Uploads in ein Archiv unter `backups/`. Die neuesten 14 Archive bleiben erhalten (`BACKUP_KEEP`). Ohne `sqlite3` auf dem Host stoppt das Skript Directus kurz und kopiert die Datei. Die Datenbankdatei nie im laufenden Betrieb einfach kopieren. Das Archiv enthält personenbezogene Daten und ist nur für den Eigentümer lesbar. Die `.env` ist nicht enthalten und muss getrennt aufbewahrt werden.
- **Wiederherstellung:** `scripts/restore.sh backups/<Archiv>` prüft das Archiv, fragt nach, stoppt Directus, verschiebt die bisherigen Daten nach `data/vorher-<Zeit>` (nichts wird gelöscht) und spielt die Sicherung ein. Mit `--yes` ohne Rückfrage. Als Benutzer ausführen, dem das Datenverzeichnis gehört. Einmal testen, bevor es ernst wird.
- **Regelmäßig sichern:** zum Beispiel täglich per Cron, und das Archiv zusätzlich an einen anderen Ort kopieren:

  ```bash
  15 3 * * * cd /pfad/zu/beirat-dabei && scripts/backup.sh >> backups/backup.log 2>&1
  ```
- **Übergabe:** Neue Administrierende bekommen die Admin-Rolle. Eine Betriebsanleitung für Nicht-Entwickler liegt unter `docs/`.

## Datenschutz

Eine Instanz speichert nur Name, E-Mail-Adresse, bevorzugten Benachrichtigungskanal, Teilnahmen und Notizen ihrer Mitglieder. Zugriff haben nur Mitglieder der Instanz. Dieses Repository enthält keine personenbezogenen Daten.

## Optional: KI-Unterstützung

Später geplant, abschaltbar und ohne Einfluss auf die festen Regeln:

- **Tagesordnung vorsortieren:** möglicherweise relevante TOPs markieren, nach dem Themenfokus der Instanz
- **Fristen erkennen:** Beteiligungsfristen aus Beschlussvorlagen ziehen, Bestätigung durch ein Mitglied
- **Notiz per Sprachnachricht:** Notizfelder aus einer kurzen Aufnahme vorausfüllen

KI-Inhalte sind immer als solche gekennzeichnet. Für Notizen und Aufnahmen kommt nur ein EU-gehostetes oder lokal betriebenes Modell in Frage.

## Instanzen

| Instanz | Gremien | Seit |
| --- | --- | --- |
| Umweltbeirat Kremmen | Bau- und Umweltausschuss | in Vorbereitung |

Du betreibst eine eigene Instanz? Ergänze sie gern per Pull Request.

## Mitmachen

Fragen, Ideen, neue RIS-Adapter und Fehlermeldungen gern als Issue oder Pull Request.

## Lizenz

[EUPL-1.2](LICENSE), die European Union Public Licence. Sie ist in allen EU-Amtssprachen [offiziell verfügbar](https://interoperable-europe.ec.europa.eu/collection/eupl).

Geänderte Versionen, auch solche, die als Webdienst betrieben werden, müssen unter der EUPL oder einer kompatiblen Lizenz offen bleiben. So kommen neue Adapter und Verbesserungen allen Instanzen zugute.

Die Lizenz gilt für den Code in diesem Repository. [Directus](https://directus.io) selbst steht unter eigener Lizenz (Business Source License), deren Bedingungen für den Betrieb einer Instanz zu beachten sind.
