# Beirat dabei – Betriebsanleitung

Für alle, die eine Instanz betreuen, ohne selbst zu programmieren. Die Anleitung geht davon aus, dass jemand den Server einmal eingerichtet hat (Docker, Reverse Proxy mit HTTPS). Befehle gibst du im Terminal des Servers im Ordner `beirat-dabei` ein.

**Die wichtigsten Adressen** (mit der `PUBLIC_URL` aus der `.env`):

| Adresse | Wofür | Wer |
| --- | --- | --- |
| `PUBLIC_URL/dashboard/` | Sitzungen, Teilnahme, Notizen, Kalender-Abo | alle Mitglieder |
| `PUBLIC_URL/admin` | Verwaltung (Directus) | nur Administrierende |

## Inhalt

1. [Was läuft da eigentlich?](#was-läuft-da-eigentlich)
2. [Stack starten, stoppen, ansehen](#stack-starten-stoppen-ansehen)
3. [Erste Einrichtung](#erste-einrichtung)
4. [Mitglied anlegen, sperren, entfernen](#mitglied-anlegen-sperren-entfernen)
5. [Gremium und Sitzung pflegen](#gremium-und-sitzung-pflegen)
6. [Einstellungen](#einstellungen)
7. [RIS-Abgleich und Benachrichtigungen umstellen](#ris-abgleich-und-benachrichtigungen-umstellen)
8. [Neue Instanz einrichten](#neue-instanz-einrichten)
9. [Aktualisieren](#aktualisieren)
10. [Backup und Wiederherstellung](#backup-und-wiederherstellung)
11. [Übergabe an neue Administrierende](#übergabe-an-neue-administrierende)
12. [Häufige Probleme](#häufige-probleme)

## Was läuft da eigentlich?

Zwei Container:

- **directus**: die Datenbank mit Verwaltungsoberfläche, dazu unsere Erweiterung. Sie holt die Sitzungen aus dem Ratsinformationssystem (RIS), prüft einmal täglich um 7 Uhr die Benachrichtigungsregeln und verschickt die Mails.
- **web**: der Webserver (Caddy). Er liefert das Dashboard aus und reicht alles andere an Directus weiter.

Alle Daten liegen im Ordner `data/` (eine Datenbankdatei plus Uploads). Die Zugangsdaten und Schlüssel stehen in der Datei `.env`. Sie ist geheim und gehört **nicht** ins Git.

## Stack starten, stoppen, ansehen

| Was | Befehl |
| --- | --- |
| Starten (und Änderungen an `.env` übernehmen) | `docker compose up -d` |
| Stoppen | `docker compose stop` |
| Neustarten | `docker compose restart directus` |
| Läuft alles? | `docker compose ps` |
| Meldungen ansehen (letzte 100 Zeilen) | `docker compose logs --tail 100 directus` |
| Meldungen live mitlesen (Abbruch mit Strg+C) | `docker compose logs -f directus` |

In den Meldungen erkennst du die Arbeit des Systems an dem Wort `beirat-dabei:`, zum Beispiel:

```
beirat-dabei: RIS-Abgleich (scharf): 1 angelegt, 0 geändert
beirat-dabei: Regellauf (scharf): 3 fällig, 3 gesendet, 0 fehlgeschlagen
```

## Erste Einrichtung

1. **`.env` anlegen.** `cp .env.example .env`, dann die Werte eintragen. Die beiden Schlüssel (`KEY`, `SECRET`) und das `MAGIC_LINK_SECRET` erzeugst du mit `openssl rand -hex 32`, jeweils einzeln. Wichtig sind außerdem `PUBLIC_URL` (die Adresse, unter der die Instanz erreichbar ist), `ADMIN_EMAIL`/`ADMIN_PASSWORD` (erstes Administratorkonto) und die Mail-Zugangsdaten (`EMAIL_*`). `EMAIL_FROM` bestimmt den Absender, am besten mit Namen: `'Umweltbeirat Kremmen <umweltbeirat@example.de>'`.
2. **Erweiterung bauen** (einmal, und nach jedem Update): `pnpm install` und `pnpm -r build`.
3. **Starten:** `docker compose up -d`. Nach etwa einer halben Minute antwortet `PUBLIC_URL/admin`.
4. **Datenmodell anlegen:**

   ```bash
   set -a; . ./.env; set +a
   DIRECTUS_URL=http://localhost:${PORT:-8055} node scripts/schema-anwenden.mjs
   ```

   Das Skript ist harmlos, du kannst es beliebig oft ausführen. (Werte in der `.env`, die Leerzeichen enthalten, müssen in Anführungszeichen stehen, zum Beispiel `REGELN_CRON='0 7 * * *'`.) Es legt Sammlungen, Rollen und Rechte an und füllt die Einstellungen vor.
5. **Anmelden** unter `PUBLIC_URL/admin` mit `ADMIN_EMAIL` und `ADMIN_PASSWORD`. Stelle die Oberfläche unter dem Profil (oben rechts) auf Deutsch. Beim ersten Anmelden fragt Directus nach einem „Project Owner“ (E-Mail-Adresse der verantwortlichen Kontaktperson, laut Directus zur Einhaltung der Lizenz MSCL-1.0-GPL). Mit „Remind Later“ kannst du das verschieben. Wenn ihr eine Adresse eintragt, nehmt die Funktionsadresse des Beirats und ersetzt keine persönliche; sie wird an Directus übermittelt. Mit `PROJECT_OWNER_ENABLED=false` in der `.env` unterbleibt die Übermittlung.
6. **Gremium, Mitglieder, Einstellungen** anlegen, wie in den folgenden Abschnitten beschrieben.
7. **Benachrichtigungen bleiben zunächst im Trockenmodus** (siehe [unten](#ris-abgleich-und-benachrichtigungen-umstellen)). Erst wenn die Sitzungen stimmen, schaltest du sie scharf.

## Mitglied anlegen, sperren, entfernen

**Anlegen:** Verwaltung → Benutzerverzeichnis → neuer Benutzer (Plus-Symbol).

| Feld | Eintrag |
| --- | --- |
| Vorname, Nachname | **Pflicht für die Anzeige.** Ohne Namen erscheint im Dashboard nur „Mitglied“. |
| E-Mail | die Adresse, an die die Benachrichtigungen gehen |
| Passwort | ein Startpasswort, das du dem Mitglied mitteilst |
| Rolle | `ub` für Mitglieder, `ub-admin` für Administrierende (die Namen stehen in der `.env`) |
| Status | `Aktiv` |

Das Mitglied meldet sich unter `PUBLIC_URL/dashboard/` an. Wer das Passwort vergessen hat, nutzt dort „Passwort vergessen“. Das funktioniert nur, wenn der Mailversand eingerichtet ist. Sonst setzt du im Benutzerverzeichnis ein neues Passwort.

Mitglieder brauchen **keinen** Zugang zur Verwaltung. Sie arbeiten nur im Dashboard und über die Links in den Mails.

**Sperren** (zum Beispiel bei Ausscheiden): beim Benutzer den Status auf `Gesperrt` (Suspended) setzen. Die Person kann sich nicht mehr anmelden, bekommt keine Mails mehr, und ihr Kalender-Abo hört auf zu funktionieren. Ihre bisherigen Eintragungen und Notizen bleiben erhalten.

**Löschen** entfernt auch die Eintragungen der Person zu Sitzungen. Notizen bleiben. Im Zweifel lieber sperren.

> **Grenze der kostenlosen Directus-Lizenz:** Es dürfen höchstens **3 Personen** Zugang zur Verwaltung haben. Dazu zählen das Administratorkonto aus der `.env` und alle mit der Rolle `ub-admin`. Mitglieder (`ub`) zählen nicht mit.

## Gremium und Sitzung pflegen

### Gremium

Verwaltung → Inhalt → **Gremien**.

| Feld | Bedeutung |
| --- | --- |
| Name | Anzeigename, erscheint im Dashboard und in den Mails |
| ris_kennung | der Name des Gremiums **genau so, wie ihn das RIS anzeigt**, zum Beispiel `Bau-/Wirtschafts- und Umweltausschuss`. Nur damit findet der Abgleich die Sitzungen. Bei Handpflege leer lassen. |
| aktiv | nur aktive Gremien werden mit dem RIS abgeglichen |

### Sitzung von Hand

Das RIS-Abgleich legt Sitzungen automatisch an. Von Hand brauchst du es, wenn das RIS ausfällt oder (noch) nicht angebunden ist: Inhalt → **Sitzungen** → neue Sitzung.

| Feld | Bedeutung |
| --- | --- |
| gremium | zu welchem Gremium die Sitzung gehört |
| beginn | Datum und Uhrzeit. Die Oberfläche zeigt die Zeit deines Browsers an, in Deutschland also die deutsche Ortszeit. |
| ort | wird im Dashboard, in Mails und im Kalender angezeigt |
| to_veroeffentlicht | Haken setzen, sobald die Tagesordnung vorliegt. Das löst die Mail „Tagesordnung veröffentlicht“ aus. |
| to_link | Adresse der Tagesordnung (muss mit `https://` beginnen) |
| abgesagt | Haken setzen, wenn die Sitzung ausfällt. Eingetragene werden informiert. |
| ris_id, ris_link | leer lassen, das füllt der Abgleich |

**Wichtig bei RIS-Anbindung:** Sitzungen, die aus dem RIS stammen (`ris_id` ist gefüllt), gleicht der Abgleich mit dem RIS ab und **überschreibt dort geänderten Beginn und Ort** wieder. Willst du etwas ausprobieren, lege dafür eine eigene Sitzung ohne `ris_id` an. Die lässt der Abgleich in Ruhe.

**Verschieben:** einfach `beginn` ändern. Bei Handpflege werden die Eingetragenen dabei nicht automatisch informiert, schreibe ihnen kurz selbst. Beim RIS-Abgleich erledigt das System das.

**Was die Fristen auslösen,** steht in der README unter „Benachrichtigungsregeln“. Kurz: sieben Tage vor der Sitzung geht eine Erinnerung raus, wenn niemand eingetragen ist, und drei Tage danach eine Bitte um die Notiz an die Teilnehmenden.

### Logo und Name

Name und Logo erscheinen in der Kopfzeile und auf der Anmeldeseite, auch ohne Anmeldung. Der Name steht in den Einstellungen (`name`). Das Logo lädst du in der Verwaltung unter Einstellungen → Projekteinstellungen → Logo hoch. Solange keins eingestellt ist, erscheint ein neutrales Platzhalter-Symbol.

### Öffentliche Unterlagen

Unter `PUBLIC_URL/dashboard/oeffentlich.html` sieht **jeder ohne Anmeldung** die nächsten Sitzungstermine mit Link zur Tagesordnung und die veröffentlichten Unterlagen: Geschäftsordnung, Stellungnahmen, Tätigkeitsberichte und weitere Dokumente. Die Seite zeigt keine Mitglieder und keine Notizen.

Unterlagen pflegst du in der Verwaltung unter Inhalt → **Dokumente**:

| Feld | Bedeutung |
| --- | --- |
| titel | so erscheint das Dokument öffentlich |
| kategorie | Geschäftsordnung, Stellungnahme, Tätigkeitsbericht oder Weitere Unterlagen |
| datum | Datum des Dokuments, die neuesten stehen oben |
| beschreibung | optional, ein bis zwei Sätze |
| datei | die Datei hochladen oder aus der Dateibibliothek wählen (PDF empfohlen) |
| veroeffentlicht | **nur mit Haken** ist das Dokument öffentlich. Ohne Haken bleibt es ein Entwurf, den niemand ohne Zugang sieht. |

Prüfe vor dem Veröffentlichen, dass im Dokument nichts Internes steht (Namen, Mailadressen, Entwurfsvermerke). Wer die Adresse einer Datei kennt, kann sie abrufen, solange sie veröffentlicht ist. Entwürfe sind nicht abrufbar.

### Notizen löschen

Teilnehmende löschen eine Notiz im Dashboard über „Notiz löschen“ (mit Sicherheitsabfrage). Weil die Notiz allen Teilnehmenden einer Sitzung gehört, verschwindet sie für alle. Das Löschen ist endgültig. Die Erinnerungsmail „Notiz fehlt“ kommt danach nicht noch einmal. Administrierende können Notizen außerdem in der Verwaltung unter Inhalt → Notizen löschen, auch wenn sie bei der Sitzung nicht dabei waren.

## Einstellungen

Inhalt → **Einstellungen** (es gibt genau einen Eintrag).

| Feld | Bedeutung |
| --- | --- |
| name | Anzeigename der Instanz, zum Beispiel `Umweltbeirat Kremmen` |
| frist_vor_tage | Tage vor der Sitzung für die Erinnerung (Standard 7) |
| frist_nach_tage | Tage nach der Sitzung für die Bitte um die Notiz (Standard 3) |
| zeitzone | `Europe/Berlin` |
| notizfragen | die Fragen im Notizformular als Liste. Jede Frage hat `schluessel`, `frage`, `typ` (`ja-nein` oder `text`) und `pflicht`. Die Frage mit dem Schlüssel `relevant` muss bleiben. |
| ris_adapter | `komfa` für das KOMFA RIS (Kremmen), `manuell` ohne Abgleich |
| ris_quelle | Adresse des RIS, bei Kremmen `https://ris-kremmen.komfa.de` |
| abo_version | Zahl erhöhen, um **alle** Kalender-Abo-Adressen ungültig zu machen (zum Beispiel wenn eine Adresse unbefugt weitergegeben wurde). Die Mitglieder holen sich danach im Dashboard die neue Adresse. |

Das Feld `themenfokus` hat derzeit keine Wirkung (es ist für die spätere KI-Vorsortierung gedacht). Den Absender der Mails legt `EMAIL_FROM` in der `.env` fest. In älteren Instanzen gibt es noch ein Feld `absender_email`, es wird nicht mehr benutzt und kann ignoriert werden.

**Alles auf einmal einrichten:** Die Einstellungen und Gremien einer neuen Instanz stehen in einer Datei (`examples/kremmen/instanz.yaml` als Vorlage). Mit `node scripts/instanz-anwenden.mjs <Datei>` überträgst du sie nach Directus (siehe [Neue Instanz](#neue-instanz-einrichten)).

## RIS-Abgleich und Benachrichtigungen umstellen

Zwei Schalter in der `.env`, jeweils mit drei Stufen:

| Schalter | Aufgabe |
| --- | --- |
| `RIS_MODUS` | Sitzungen aus dem RIS holen (dreimal täglich) |
| `REGELN_MODUS` | Mails nach den Regeln verschicken (täglich 7 Uhr und nach Änderungen an Teilnahmen) |

| Stufe | Wirkung |
| --- | --- |
| `aus` | tut nichts |
| `trocken` | **nur ins Protokoll schreiben**, was passieren würde. Nichts wird geändert, nichts verschickt. |
| `scharf` | arbeitet wirklich |

**Empfohlene Reihenfolge bei der Inbetriebnahme:**

1. Beide Schalter auf `trocken` lassen. In `docker compose logs --tail 200 directus` stehen Zeilen mit `[trocken]`: welche Sitzungen angelegt würden und welche Mails fällig wären.
2. Prüfen, ob das stimmt. Mit `ris_adapter` und `ris_quelle` in den Einstellungen und der `ris_kennung` am Gremium.
3. `RIS_MODUS=scharf` setzen und `docker compose up -d`. Nach dem nächsten Lauf (um 6:15, 12:15 oder 18:15 Uhr) stehen die Sitzungen im Dashboard. Der Abgleich holt auch die vergangenen 45 Tage (`RIS_RUECKBLICK_TAGE`), damit die letzte Sitzung dasteht und Notizen nachträglich möglich sind. Zum Ausprobieren kannst du für den ersten Lauf `RIS_CRON='* * * * *'` setzen (jede Minute) und die Zeile danach wieder entfernen.
4. Das Dashboard kontrollieren. Dann erst `REGELN_MODUS=scharf` setzen und wieder `docker compose up -d`.

> **Vorsicht beim Scharfschalten der Regeln:** Gleich danach gehen alle gerade fälligen Mails raus, zum Beispiel „Tagesordnung veröffentlicht“ zu allem, was schon im System steht. Mails verschickt das System nur einmal pro Anlass (Versandprotokoll), du kannst sie aber nicht zurückholen. Informiere die Mitglieder vorher.

Zum Testen des Mailversands ohne Wirkung auf alle: lege vorher nur dich selbst als Mitglied an.

## Neue Instanz einrichten

Für einen weiteren Beirat: Repository klonen, `examples/kremmen/` kopieren (zum Beispiel nach `examples/mein-beirat/`) und anpassen.

- `instanz.yaml`: Name, Fristen, Notizfragen, RIS-Adapter, Rollennamen, Gremien. Fehler in der Datei meldet das Skript verständlich.
- `.env.example`: Vorlage für die geheime `.env` (Adressen, Schlüssel, Mailzugang).

Dann, nach „Erste Einrichtung“ Schritt 1 bis 4:

```bash
set -a; . ./.env; set +a
export DIRECTUS_URL=http://localhost:${PORT:-8055}
node scripts/instanz-anwenden.mjs --trocken examples/mein-beirat/instanz.yaml
node scripts/instanz-anwenden.mjs examples/mein-beirat/instanz.yaml
```

Der erste Aufruf zeigt nur, was sich ändern würde. Der zweite fragt nach und überträgt es. Die Rollen müssen in Directus schon vorhanden sein (sie entstehen im Datenmodell-Schritt mit `ROLLE_MITGLIED` und `ROLLE_ADMIN` aus der `.env`).

**Danach ist Directus maßgeblich.** Fristen, Texte und Gremien änderst du in der Verwaltung. Führst du das Skript später erneut aus, zeigt es an, was es dort zurücksetzen würde, und fragt vorher nach. Es löscht nie Gremien.

## Aktualisieren

Vorher immer ein Backup machen (`scripts/backup.sh`). Dann:

```bash
git pull
pnpm install
pnpm -r build
docker compose pull
docker compose up -d
```

Anschließend das Datenmodell nachziehen (siehe Schritt 4 der Ersten Einrichtung). Neue Versionen können neue Felder mitbringen.

`docker compose pull` lädt neue Programmversionen nur, wenn sich die Versionsnummer in der `docker-compose.yml` geändert hat. Directus ist dort bewusst auf eine feste Version gesetzt. Ein Wechsel auf eine neue Directus-Version gehört in einen eigenen Schritt: erst Backup, dann ändern, dann prüfen, ob Anmeldung, Dashboard und ein Test-Eintrag funktionieren.

## Backup und Wiederherstellung

**Sichern:**

```bash
scripts/backup.sh
```

Das Archiv liegt danach unter `backups/beirat-dabei-<Datum>-<Zeit>.tar.gz`. Die letzten 14 bleiben erhalten. Das Skript darf bei laufendem Betrieb ausgeführt werden. **Kopiere die Archive zusätzlich an einen anderen Ort** (anderer Rechner, Cloud-Speicher), sonst sind sie mit dem Server weg. Sie enthalten personenbezogene Daten, bewahre sie entsprechend auf.

Regelmäßig, zum Beispiel jede Nacht um 3:15 Uhr, per Cron (`crontab -e`):

```
15 3 * * * cd /pfad/zu/beirat-dabei && scripts/backup.sh >> backups/backup.log 2>&1
```

**Nicht im Archiv:** die `.env` mit allen Schlüsseln. Bewahre sie getrennt und sicher auf (zum Beispiel im Passwortmanager des Beirats). Ohne sie kannst du den Stack nicht mit denselben Zugängen neu aufbauen.

**Einspielen:**

```bash
scripts/restore.sh backups/beirat-dabei-20261020-031500.tar.gz
```

Das Skript prüft das Archiv, fragt nach, stoppt Directus kurz, spielt die Sicherung ein und startet wieder. Die bisherigen Daten werden **nicht gelöscht**, sondern nach `data/vorher-<Zeit>` verschoben. Wenn alles läuft, kannst du diesen Ordner später entfernen.

Führe die Wiederherstellung einmal zur Probe aus, bevor du sie brauchst, am besten auf einem zweiten Rechner.

## Übergabe an neue Administrierende

1. Neue Person im Benutzerverzeichnis anlegen oder ihre Rolle auf `ub-admin` setzen (maximal 3 Zugänge zur Verwaltung, siehe oben).
2. Ihr diese Anleitung geben.
3. Den Zugang zum Server, die `.env` und die Mail-Zugangsdaten (SMTP-Konto des Beirats) sicher übergeben.
4. Die bisherige Person auf `ub` zurückstufen oder sperren.
5. Das Passwort des Administratorkontos aus der `.env` ändern (Verwaltung → Benutzerverzeichnis) und die `.env` anpassen.

## Häufige Probleme

| Problem | Ursache und Abhilfe |
| --- | --- |
| **`docker compose ps` zeigt „unhealthy“** | Ältere Versionen der `docker-compose.yml` prüften die Gesundheit unter einer Adresse, die nicht erreichbar war. Aktuelle Version holen (`git pull`) und `docker compose up -d`. |
| **Kalender-Abo schlägt fehl (zum Beispiel „Beim Abonnieren ist ein Fehler aufgetreten“)** | Kalender-Apps verlangen für Abos meist eine **https**-Adresse und lehnen `http://localhost` ab. Im Betrieb hinter HTTPS funktioniert es. Zum Ausprobieren hilft „Einmalig herunterladen (.ics)“ im Dashboard. Der Download aktualisiert sich aber nicht von selbst. |
| **Dashboard zeigt „Lade …“ oder bleibt leer** | `docker compose ps` prüfen, beide Container müssen laufen. Meldungen mit `docker compose logs --tail 100 directus` und `docker compose logs --tail 100 web` ansehen. |
| **Die Anmeldung geht, aber danach landet man wieder im Login** | `SESSION_COOKIE_SECURE=true` in der `.env`, die Seite wird aber ohne HTTPS aufgerufen. Im Betrieb immer über HTTPS gehen. Nur für lokale Tests `false` setzen. |
| **„E-Mail-Adresse oder Passwort stimmen nicht“** | Tippfehler, oder das Mitglied ist gesperrt oder hat keine Rolle `ub`/`ub-admin`. Im Benutzerverzeichnis Status und Rolle prüfen. |
| **„Dieses Konto ist kein aktives Mitglied“** | Der Benutzer hat nicht die Rolle `ub` oder `ub-admin` oder ist gesperrt. Auch das Administratorkonto aus der `.env` ist kein Mitglied. Lege für dich ein eigenes Mitglied an. |
| **Mails kommen nicht an** | 1. Steht `REGELN_MODUS` auf `scharf`? Bei `trocken` wird nichts verschickt. 2. In den Meldungen nach `Versand … fehlgeschlagen` suchen: meist falsche SMTP-Zugangsdaten (`EMAIL_*`). Fehlgeschlagene Mails werden beim nächsten Lauf wiederholt. 3. Spam-Ordner prüfen. |
| **Ein Link in der Mail sagt „abgelaufen“** | Links aus Mails gelten bis 14 Tage nach der Sitzung, der „Rückgängig“-Link nach einem Klick nur 30 Minuten. Das Mitglied meldet sich im Dashboard an und trägt sich dort ein. |
| **Der Abgleich legt keine Sitzungen an** | 1. `RIS_MODUS` ist `trocken` oder `aus`. 2. In den Einstellungen fehlen `ris_adapter=komfa` oder `ris_quelle`. 3. Die `ris_kennung` am Gremium stimmt nicht exakt mit dem Namen im RIS überein (auf Schrägstriche und Bindestriche achten). 4. Das Gremium ist nicht `aktiv`. Die Meldungen zeigen `RIS-Abgleich übersprungen` oder `[trocken] RIS-Abgleich: …`. |
| **Eine Sitzung wurde als abgesagt markiert, obwohl sie stattfindet** | Das System markiert eine kommende Sitzung als abgesagt, wenn sie bei vollständigem Abruf im RIS fehlt. Prüfe das RIS. Wenn die Sitzung dort steht, nimm im Eintrag den Haken `abgesagt` wieder heraus. Zurückgenommen wird nichts automatisch. |
| **„Couldn't register cron hook“ in den Meldungen** | Der Zeitplan in der `.env` (`REGELN_CRON`, `RIS_CRON`) ist ungültig. Entferne die Zeile, dann gilt der Standard. |
| **Fehlermeldung zu Lizenzgrenzen beim Anlegen eines Benutzers oder Sammlungen** | Mehr als 3 Personen mit Zugang zur Verwaltung. Eine Person auf `ub` zurückstufen. |
| **Im Dashboard steht „Mitglied“ statt eines Namens** | Beim Benutzer fehlen Vor- und Nachname. |
| **Nach einem Update läuft nichts mehr** | Meldungen ansehen. Haben `pnpm -r build` und das Datenmodell-Skript funktioniert? Notfalls zum letzten Backup zurück (`scripts/restore.sh`) und die alte Version mit `git checkout` wieder einspielen. |
| **Port belegt beim Start** | In der `.env` einen anderen `PORT` setzen und den Reverse Proxy darauf zeigen lassen. |

Kommst du nicht weiter: Meldungen sichern (`docker compose logs --tail 300 directus > fehler.txt`, ohne Passwörter weiterzugeben) und im Repository ein Issue anlegen.
