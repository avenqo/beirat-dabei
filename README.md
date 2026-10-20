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

Die Regeln werden einmal täglich geprüft. Ein Versandprotokoll verhindert doppelte Nachrichten.

## RIS-Adapter

Der Kern spricht nur mit einer kleinen Schnittstelle: Sitzungen eines Gremiums abrufen und die Tagesordnung einer Sitzung abrufen. Dahinter stehen austauschbare Adapter:

| Adapter | Wann | Status |
| --- | --- | --- |
| OParl | das RIS bietet den offenen [OParl-Standard](https://oparl.org) | geplant |
| iCal / RSS | das RIS liefert nur Feeds | geplant |
| Scraper | für verbreitete RIS-Produkte ohne Schnittstelle | nach Bedarf |
| Manuell | Termine werden von Hand gepflegt | geplant |

Gebaut wird zuerst, was die erste Instanz braucht. Weitere Adapter sind als Beitrag willkommen.

## Architektur

```
RIS der Kommune ──▶ RIS-Adapter ──▶ Directus + SQLite ──▶ Dashboard (Browser)
                                         │
                          ┌──────────────┴──────────────┐
                          ▼                             ▼
                  Extension                      Regeln (Flows)
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
| Directus-Extension | Magic Links und iCal-Feed |
| Directus Flows | die Benachrichtigungsregeln |
| RIS-Adapter | holt Termine und Tagesordnungen |
| Dashboard | schlanke statische Seite gegen die Directus-API |

Jede Instanz läuft als eigener Docker-Compose-Stack und lässt sich durch Kopieren von Konfiguration und Datenbankdatei auf einen anderen Server umziehen. Eine gemeinsame Plattform für mehrere Beiräte ist bewusst nicht vorgesehen.

## Geplanter Aufbau

```
beirat-dabei/
├── docker-compose.yml
├── .env.example
├── directus/
│   ├── extensions/     # Magic Links, iCal-Feed
│   └── sync/           # Schema, Flows, Rollen als Code (directus-sync)
├── adapters/           # RIS-Adapter: oparl, ical, manual, …
├── dashboard/          # statisches Frontend
├── scripts/
│   ├── backup.sh
│   └── restore.sh
├── examples/
│   └── kremmen/        # Beispielkonfiguration, ohne Geheimnisse
└── docs/               # Konzept und Betriebsanleitung
```

## Eigene Instanz aufsetzen

> Wird ergänzt, sobald der Stack lauffähig ist.

```bash
git clone https://github.com/<owner>/beirat-dabei.git
cd beirat-dabei
cp .env.example .env    # Werte eintragen, siehe unten
docker compose up -d
```

Danach in der Admin-Oberfläche die Einstellungen setzen: Name, Gremien, Fristen, Notizfragen, RIS-Adapter. Als Vorlage dient `examples/kremmen/`.

Wichtige Werte in `.env`:

| Variable | Bedeutung |
| --- | --- |
| `PUBLIC_URL` | öffentliche Adresse der Instanz |
| `KEY`, `SECRET` | Directus-Schlüssel, zufällig erzeugen |
| `DB_CLIENT=sqlite3`, `DB_FILENAME` | Datenbank |
| `EMAIL_*` | SMTP-Zugang für den Versand |
| `MAGIC_LINK_SECRET` | Schlüssel zum Signieren der Magic Links |
| `TZ=Europe/Berlin` | Zeitzone für die Fristen |

**Keine echten Werte committen.** Die `.env` steht in `.gitignore`.

## Rollen

| Rolle | Rechte |
| --- | --- |
| Mitglied | Dashboard sehen, sich ein- und austragen, Notizen schreiben |
| Admin | zusätzlich Mitglieder, Gremien, Sitzungen, Einstellungen und Flows verwalten |

Die Rollennamen sind je Instanz frei wählbar.

## Betrieb

- **Konfiguration als Code:** Schema, Flows, Rollen und Berechtigungen werden mit [directus-sync](https://github.com/tractr/directus-sync) im Repo gehalten.
- **Backup:** `scripts/backup.sh` sichert die SQLite-Datei per `sqlite3 .backup` und die Uploads. Die Datenbankdatei nie im laufenden Betrieb einfach kopieren.
- **Wiederherstellung:** `scripts/restore.sh`. Einmal testen, bevor es ernst wird.
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

Noch festzulegen, z. B. [EUPL-1.2](https://interoperable-europe.ec.europa.eu/collection/eupl) oder MIT.
