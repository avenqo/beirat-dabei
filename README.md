# Beirat dabei

Sitzungsbegleitung für Beiräte und Initiativen, die die Ausschüsse ihrer Kommune verfolgen: Termine im Blick behalten, Teilnahme abstimmen, Ergebnisse festhalten.

> **Status:** Vorabversion. Der Code läuft lokal und im Docker-Stack. Der Betrieb auf einem Server mit echtem Mailversand wird gerade erprobt. Erste Instanz ist der Umweltbeirat Kremmen.

## Worum es geht

Ein Beirat möchte bei den Sitzungen bestimmter Ausschüsse mit mindestens einem Mitglied vertreten sein. *Beirat dabei* übernimmt die Abstimmung dafür:

- **Dashboard** mit allen Sitzungsterminen, Link zur Tagesordnung, Teilnehmenden und Ergebnissen
- **Ein-Klick-Teilnahme** über Links in E-Mails, ohne Anmeldung
- **Kurznotiz** nach der Sitzung mit einstellbaren Fragen
- **Automatische Benachrichtigungen** nach festen Regeln mit einstellbaren Fristen
- **Kalender-Abo** (iCal) für den eigenen Kalender
- **Öffentlicher Bereich** mit den nächsten Terminen und den veröffentlichten Unterlagen

Termine und Tagesordnungen kommen über einen Adapter aus dem Ratsinformationssystem (RIS) der Kommune.

## Für wen

Für jedes Gremium, das öffentliche Ausschusssitzungen begleiten will, zum Beispiel Umwelt-, Senioren-, Jugend- oder Behindertenbeiräte, Ortsbeiräte oder Bürgerinitiativen. Jede Gruppe betreibt ihre eigene Instanz.

## Dokumentation

| Dokument | Inhalt |
| --- | --- |
| [Installation](docs/installation.md) | Schritt für Schritt auf einen Server mit Docker, Reverse Proxy, HTTPS und Mailversand |
| [Betrieb](docs/Betrieb.md) | Alltag: Mitglieder, Gremien, Sitzungen, Einstellungen, Aktualisieren, Backup, Probleme |
| [Kurzanleitung für Mitglieder](docs/Beirat%20dabei%20–%20Kurzanleitung%20für%20Mitglieder.md) | zum Weitergeben an die Beiratsmitglieder |
| [Produktvorstellung](docs/Produktvorstellung.md) | für Beiräte, die entscheiden, ob es etwas für sie ist |
| [Konzept](docs/Beirat-dabei-Konzept.md) | Entwurf, Regeln und Grenzfälle |
| [Sicherheit](SECURITY.md) | Schwachstellen melden, Annahmen, Härtung |

## Benachrichtigungsregeln

| # | Auslöser | Bedingung | Empfänger |
| --- | --- | --- | --- |
| 1 | Tagesordnung veröffentlicht | – | alle Mitglieder |
| 2 | Jemand trägt sich ein | – | alle anderen Mitglieder |
| 3 | *n* Tage vor der Sitzung (Standard: 7) | niemand eingetragen | alle Mitglieder |
| 4 | Letzte Person trägt sich aus | innerhalb dieser Frist | alle Mitglieder |
| 5 | *m* Tage nach der Sitzung (Standard: 3) | keine Notiz vorhanden | die Teilnehmenden |

Die Regeln werden einmal täglich um 7 Uhr geprüft, außerdem kurz nach jeder Änderung an einer Teilnahme. Ein Versandprotokoll verhindert doppelte Nachrichten. Schlägt ein Versand fehl, wird er beim nächsten Lauf wiederholt. Austragen außerhalb der Frist löst keine Nachricht aus.

`REGELN_MODUS` steuert den Versand: `aus`, `trocken` (nur ins Log schreiben, Standard) oder `scharf`. Erst auf `scharf` stellen, wenn die Sitzungen im System stimmen, sonst gehen beim ersten Lauf Mails zu allem Bestehenden raus. Sitzungen, die mehr als 60 Tage zurückliegen, werden nicht mehr bewertet.

Links in Mails gelten bis zum Sitzungsende plus 14 Tage (`MAGIC_LINK_NACHLAUF_TAGE`, `SITZUNGSDAUER_STUNDEN`). Der Rückgängig-Link nach einem Klick gilt 30 Minuten. Die Mails verweisen auf `DASHBOARD_URL/link.html?token=…`. Die Seite zeigt eine Bestätigung, erst der Knopf führt die Aktion aus.

### Sitzungsstatus

| Status | Bedeutung |
| --- | --- |
| Besetzt | mindestens eine Person eingetragen |
| Noch offen / Dringend | niemand eingetragen, mehr als *n* Tage bzw. *n* Tage oder weniger bis zur Sitzung |
| Notiz fehlt | Sitzung vorbei, mindestens eine aktive Teilnahme, keine Notiz |
| Nicht besetzt | Sitzung vorbei, niemand eingetragen |
| Dokumentiert | Sitzung vorbei, Notiz vorhanden |
| Abgesagt | die Sitzung fällt aus |

## RIS-Adapter

Der Kern spricht nur mit einer kleinen Schnittstelle: Sitzungen eines Gremiums abrufen und die Tagesordnung einer Sitzung abrufen. Dahinter stehen austauschbare Adapter:

| Adapter | Wann | Status |
| --- | --- | --- |
| `komfa` | [KOMFA RIS](https://www.komfa.de): Monatskalender, iCal je Sitzung und Tagesordnungsseite | umgesetzt |
| OParl | das RIS bietet den offenen [OParl-Standard](https://oparl.org) | geplant |
| iCal / RSS | das RIS liefert nur Feeds | geplant |
| Scraper für andere Produkte | z. B. SessionNet oder ALLRIS | nach Bedarf |
| `manuell` | Termine werden von Hand gepflegt, kein Abgleich | umgesetzt |

**Abgleich.** Dreimal täglich (`RIS_CRON`) werden die Sitzungen der aktiven Gremien mit dem RIS verglichen, von 45 Tagen zurück (`RIS_RUECKBLICK_TAGE`) bis 90 Tage voraus. Erkannt werden neue Sitzungen, Verschiebungen, Orts- und Absageänderungen sowie das Erscheinen einer Tagesordnung. Eine kommende Sitzung, die bei vollständigem Abruf im RIS fehlt, gilt als abgesagt. Zurückgenommen wird nichts automatisch. Wie bei den Regeln steuert `RIS_MODUS` (`aus`, `trocken`, `scharf`) den Betrieb. Der Adapter nutzt einen erkennbaren User-Agent, pausiert zwischen den Abrufen und ruft die Tagesordnung nur ab, solange sie noch nicht als veröffentlicht gilt. Klärt vorher, ob der Betreiber des RIS den automatischen Abruf zulässt.

**Einrichten für KOMFA:** In den Einstellungen den RIS-Adapter auf `komfa` und die Adresse des RIS setzen (z. B. `https://ris.musterstadt.example`). Bei jedem Gremium die RIS-Kennung auf den Titel im Kalender setzen, ohne „Stadt …, “ davor (z. B. `Bau- und Umweltausschuss`).

## Architektur

```
RIS der Kommune ──▶ RIS-Adapter ──▶ Payload CMS + SQLite ──▶ Dashboard (Browser)
                                         │
                          ┌──────────────┴──────────────┐
                          ▼                             ▼
                    Endpoints                    Zeitpläne
              Dashboard-API, Links, iCal      Regeln, RIS-Abgleich
                                                        │
                                                        ▼
                                                     E-Mail
```

| Baustein | Aufgabe |
| --- | --- |
| [Payload CMS](https://payloadcms.com) (MIT) | Datenmodell, Rollen, Zugriffsregeln, Verwaltungsoberfläche, Anmeldung |
| SQLite | Datenbank als eine Datei im Volume |
| `app/` | Payload-Konfiguration, Endpoints und Zeitpläne |
| `packages/core` | Fristen, Regeln, Token, iCal als reine, getestete Funktionen |
| `packages/handlers` | Antworten der Endpoints, Mailtexte, Regellauf, Abgleich, öffentliche Seiten. Kennt Payload nicht. |
| `packages/ris-adapter` | holt Termine und Tagesordnungen |
| `dashboard/` | schlanke statische Seiten gegen die API |
| Caddy | eine Adresse für Dashboard und Anwendung |

Jede Instanz läuft als eigener Docker-Compose-Stack und lässt sich durch Kopieren von `.env` und `data/` auf einen anderen Server umziehen. Eine gemeinsame Plattform für mehrere Beiräte ist bewusst nicht vorgesehen. Die Benachrichtigungsregeln sind Code, nicht Konfiguration: versioniert, reviewbar und per Unit-Test abgedeckt.

```
beirat-dabei/
├── app/                  # Payload: Konfiguration, Sammlungen, Endpoints, Zeitpläne, Migrationen
├── packages/
│   ├── core/             # Regeln, Fristen, Token, iCal
│   ├── handlers/         # Endpoint-Logik, Mails, Regellauf, Abgleich
│   └── ris-adapter/      # RIS-Schnittstelle, KOMFA
├── dashboard/            # statisches Frontend (HTML, CSS, ES-Module)
├── docs/                 # Dokumentation und Vorlagen für Impressum und Datenschutz
├── scripts/              # backup.sh, restore.sh
├── Dockerfile, docker-compose.yml, Caddyfile, .env.example
└── SECURITY.md
```

## Eigene Instanz aufsetzen

Kurzfassung (Einzelheiten in der [Installationsanleitung](docs/installation.md)):

```bash
git clone https://github.com/avenqo/beirat-dabei.git
cd beirat-dabei
cp .env.example .env              # Werte eintragen, Schlüssel mit openssl rand -hex 32
mkdir -p data && sudo chown 1000:1000 data
docker compose up -d --build
```

Danach unter `PUBLIC_URL/admin` die erste Person registrieren: Sie wird das technische Administratorkonto. Alles Weitere (Gremien, Einstellungen, Mitglieder) steht in der [Betriebsanleitung](docs/Betrieb.md). Zum Entwickeln: Node 22, `corepack pnpm install`, Pakete bauen, `pnpm dev` im Ordner `app/` (siehe `app/.env.example`).

Wichtige Werte in `.env`:

| Variable | Bedeutung |
| --- | --- |
| `PUBLIC_URL` | öffentliche Adresse der Instanz |
| `PAYLOAD_SECRET`, `MAGIC_LINK_SECRET` | Schlüssel, zufällig erzeugen |
| `EMAIL_FROM`, `EMAIL_FROM_NAME`, `EMAIL_SMTP_*` | Absender und SMTP-Zugang |
| `REGELN_MODUS`, `RIS_MODUS` | `aus`, `trocken`, `scharf` |
| `TZ` | Zeitzone für Fristen und Zeitpläne |

**Keine echten Werte committen.** Die `.env` steht in `.gitignore`.

## Dashboard und öffentlicher Bereich

Statische Seiten ohne Framework unter `dashboard/`: `index.html` für Mitglieder, `link.html` für Links aus Mails, `passwort.html` zum Festlegen eines Passworts, `oeffentlich.html` ohne Anmeldung. Caddy liefert sie unter `/dashboard/` aus und reicht alles andere an die Anwendung weiter. So sprechen die Seiten ohne Cross-Origin-Einstellungen mit der API.

Der öffentliche Bereich zeigt die nächsten Sitzungstermine mit Tagesordnung und die veröffentlichten Unterlagen (Geschäftsordnung, Stellungnahmen, Tätigkeitsberichte, weitere Dokumente). Gepflegt wird das in der Verwaltung unter „Dokumente“. Nur Dokumente mit Haken bei „Veröffentlicht“ sind sichtbar, und die Dateien laufen über einen Endpoint, nicht über die offene Dateiablage. Mitglieder und Notizen erscheinen dort nie.

Vergangene Sitzungen erscheinen nach Jahr gegliedert, ältere Jahre eingeklappt, ab sieben Sitzungen mit Suchfeld (Gremium, Ort, Datum, Notizen). Gespeichert bleibt alles unbegrenzt, eine automatische Löschfrist gibt es noch nicht.

Name und Logo der Instanz stehen in der Kopfzeile aller Seiten. Das Logo lädt man in den Einstellungen hoch, bis dahin erscheint ein Platzhalter. Dort lässt sich auch die Akzentfarbe wählen.

## Impressum und Datenschutz

Impressum und Datenschutzerklärung (nach Art. 13 DSGVO) sind in der Fußzeile jeder Seite verlinkt und werden in den Einstellungen gepflegt. Beim ersten Start trägt die Anwendung die Vorlagen aus `docs/vorlagen/` ein. Offene Platzhalter erscheinen gelb markiert. Die Vorlagen sind eine Arbeitsgrundlage und müssen vor der Veröffentlichung rechtlich geprüft werden.

## Kalender-Abo

Jedes Mitglied findet im Dashboard unter „Kalender abonnieren“ eine persönliche Adresse für den eigenen Kalender (Google, Apple, Outlook, Thunderbird). Der Feed enthält alle Sitzungen der letzten 60 Tage und der Zukunft mit Ort, Teilnehmenden, Link zur Tagesordnung und Absagen. Kalender-Apps laden ihn alle paar Stunden neu.

Der Token ist pro Mitglied aus `MAGIC_LINK_SECRET` abgeleitet und nirgends gespeichert. Gesperrte Mitglieder bekommen sofort 404. Alle Abo-Adressen auf einmal ungültig machen: in den Einstellungen die „Version der Kalender-Abos“ erhöhen. Wer die Adresse weitergibt, gibt die Termine weiter, nicht mehr.

## Schnittstelle

Die Endpoints liegen unter `/beirat-dabei/…` (intern `/api/beirat-dabei/…`). Mitglieder greifen nie direkt auf Daten zu, die Endpoints prüfen Rolle, Fristen und Besitz im Code.

| Pfad | Zugang | Zweck |
| --- | --- | --- |
| `GET /dashboard` | angemeldet | kommende und vergangene Sitzungen, Teilnehmende (nur Namen), Notizfragen |
| `POST /teilnahme` | angemeldet | `{sitzung, aktion}` mit `eintragen`, `austragen`, `nicht-teilgenommen`, `dabei-gewesen` |
| `POST /notiz` | angemeldet | `{sitzung, relevant, antworten}`, nur für Teilnehmende nach der Sitzung |
| `POST /notiz/loeschen` | angemeldet | `{sitzung}`, löscht die Notiz endgültig, nur für Teilnehmende |
| `GET /abo` | angemeldet | die persönliche Adresse des Kalender-Abos |
| `GET /instanz` | öffentlich | Name, Logo und Akzentfarbe für Kopfzeile und Anmeldeseite |
| `GET /oeffentlich` | öffentlich | nächste Sitzungen und veröffentlichte Unterlagen |
| `GET /rechtliches` | öffentlich | Impressum und Datenschutzerklärung |
| `GET /datei/:id` | öffentlich | die Datei eines veröffentlichten Dokuments |
| `GET /link/:token` | Link aus Mail | Angaben für die Bestätigungsseite, ändert nichts |
| `POST /link/:token` | Link aus Mail | führt die Aktion aus, liefert einen Rückgängig-Link |
| `GET /ical/:token.ics` | Abo-Token | iCal-Feed mit allen Sitzungsterminen |

Anmeldung und Passwort-Reset laufen über die Schnittstelle von Payload (`/api/users/login`, `/api/users/forgot-password`, `/api/users/reset-password`).

## Rollen

| Rolle | Rechte |
| --- | --- |
| Mitglied | Dashboard sehen, sich ein- und austragen, Notizen schreiben |
| Admin | zusätzlich Gremien, Sitzungen, Dokumente und Einstellungen in der Verwaltung pflegen und Mitglieder ansehen |
| Technisches Administratorkonto | zusätzlich Mitglieder anlegen, ändern, sperren und löschen. Ist selbst kein Mitglied und bekommt keine Mails. |

Die Rechte stehen als Code in `app/src/access.ts` und `app/src/collections/`. Nur das technische Konto darf Benutzer ändern. Sonst könnte sich jede Person mit diesem Recht zum Administrator machen (siehe [SECURITY.md](SECURITY.md)).

## Betrieb

- **Backup:** `scripts/backup.sh` sichert die SQLite-Datei per `sqlite3 .backup` (auch bei laufendem Betrieb konsistent) und die Uploads in ein Archiv unter `backups/`. Die neuesten 14 Archive bleiben erhalten (`BACKUP_KEEP`). Ohne `sqlite3` auf dem Host stoppt das Skript die Anwendung kurz. Das Archiv enthält personenbezogene Daten und ist nur für den Eigentümer lesbar. Die `.env` ist nicht enthalten und muss getrennt aufbewahrt werden.
- **Wiederherstellung:** `scripts/restore.sh backups/<Archiv>` prüft das Archiv, fragt nach, stoppt die Anwendung, verschiebt die bisherigen Daten nach `data/vorher-<Zeit>` (nichts wird gelöscht) und spielt die Sicherung ein. Mit `--yes` ohne Rückfrage. Einmal testen, bevor es ernst wird.
- **Regelmäßig sichern**, zum Beispiel täglich per Cron, und das Archiv zusätzlich an einen anderen Ort kopieren:

  ```
  15 3 * * * cd /pfad/zu/beirat-dabei && scripts/backup.sh >> backups/backup.log 2>&1
  ```
- **Schema-Änderungen** brauchen eine Migration (`pnpm payload migrate:create <name>` im Ordner `app/`). Sie wird beim Start der Anwendung eingespielt.

## Datenschutz

Eine Instanz speichert nur Name, E-Mail-Adresse, Teilnahmen und Notizen ihrer Mitglieder. Zugriff haben nur Mitglieder der Instanz. Dieses Repository enthält keine personenbezogenen Daten. Beispiel- und Testdaten sind erfunden.

## Optional: KI-Unterstützung

Später geplant, abschaltbar und ohne Einfluss auf die festen Regeln:

- **Tagesordnung vorsortieren:** möglicherweise relevante TOPs markieren, nach dem Themenfokus der Instanz
- **Fristen erkennen:** Beteiligungsfristen aus Beschlussvorlagen ziehen, Bestätigung durch ein Mitglied
- **Notiz per Sprachnachricht:** Notizfelder aus einer kurzen Aufnahme vorausfüllen

KI-Inhalte sind immer als solche gekennzeichnet. Für Notizen und Aufnahmen kommt nur ein EU-gehostetes oder lokal betriebenes Modell in Frage.

## Instanzen

| Instanz | Gremien | Seit |
| --- | --- | --- |
| Umweltbeirat Kremmen | Bau-/Wirtschafts- und Umweltausschuss | in Vorbereitung |

Du betreibst eine eigene Instanz? Ergänze sie gern per Pull Request.

## Mitmachen

Fragen, Ideen, neue RIS-Adapter und Fehlermeldungen gern als Issue oder Pull Request. Sicherheitsprobleme bitte wie in [SECURITY.md](SECURITY.md) beschrieben melden.

## Lizenz

[EUPL-1.2](LICENSE), die European Union Public Licence. Sie ist in allen EU-Amtssprachen [offiziell verfügbar](https://interoperable-europe.ec.europa.eu/collection/eupl). Geänderte Versionen, auch solche, die als Webdienst betrieben werden, müssen unter der EUPL oder einer kompatiblen Lizenz offen bleiben. So kommen neue Adapter und Verbesserungen allen Instanzen zugute.

Die Lizenz gilt für den Code in diesem Repository. [Payload CMS](https://payloadcms.com) und die übrigen Bibliotheken haben eigene Lizenzen (Payload: MIT). Die Gründe für den Wechsel von Directus zu Payload stehen im Konzept.
