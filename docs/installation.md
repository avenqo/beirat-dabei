# Installation

Schritt-für-Schritt-Anleitung, um eine eigene Instanz von *Beirat dabei* auf einem Linux-Server einzurichten.

> **Status:** Diese Anleitung beschreibt den Zielzustand. Solange der Stack noch entsteht, können sich Befehle und Dateinamen ändern.

**Zeitbedarf:** etwa 1 bis 2 Stunden, davon das meiste für DNS, E-Mail-Zugang und die Konfiguration.
**Vorkenntnisse:** Arbeiten auf der Kommandozeile per SSH. Docker-Kenntnisse helfen, sind aber nicht nötig.

Die Beispielwerte stammen aus der Kremmener Instanz (`examples/kremmen/`). Ersetze sie durch deine eigenen.

---

## Überblick

| Schritt | Was passiert |
| --- | --- |
| 1 | Voraussetzungen prüfen |
| 2 | DNS-Eintrag für die Subdomain anlegen |
| 3 | Docker installieren |
| 4 | Repository auf den Server holen |
| 5 | `.env` mit Schlüsseln und Zugangsdaten füllen |
| 6 | `instanz.yaml` mit Name, Gremien, Fristen anpassen |
| 7 | Reverse Proxy und HTTPS einrichten |
| 8 | Stack starten |
| 9 | Erste Anmeldung als Admin |
| 10 | Schema, Rollen und Rechte einspielen |
| 11 | Instanz-Konfiguration übertragen |
| 12 | Mitglieder anlegen |
| 13 | Funktionstest |
| 14 | Backups einrichten |

Danach: [Aktualisieren](#aktualisieren), [Umzug auf einen anderen Server](#umzug-auf-einen-anderen-server), [Fehlerbehebung](#fehlerbehebung).

---

## 1. Voraussetzungen prüfen

| Was | Mindestens | Hinweis |
| --- | --- | --- |
| Server | Linux (z. B. Debian 12 oder Ubuntu 24.04), 1 GB RAM, 5 GB freier Speicher | Ein kleiner VPS reicht. Ein bestehender Server mit Docker kann mitgenutzt werden. |
| Zugang | SSH mit `sudo`-Rechten | |
| Domain | eine Subdomain, die du im DNS verwalten kannst | z. B. `umweltbeirat.example.de` |
| E-Mail | ein SMTP-Konto für den Versand | am besten eine Funktionsadresse des Beirats, kein privates Konto |
| RIS | die Adresse des Ratsinformationssystems deiner Kommune | siehe [RIS-Adapter](../README.md#ris-adapter) |
| Ports | 80 und 443 von außen erreichbar | für HTTPS-Zertifikate |

Notiere dir vorab:

- Hostname der Instanz, z. B. `umweltbeirat.example.de`
- SMTP-Server, Port, Benutzer, Passwort und Absenderadresse
- Name und E-Mail-Adresse der ersten Person mit Admin-Rechten
- den genauen Namen des begleiteten Gremiums, wie er im RIS steht

---

## 2. DNS-Eintrag anlegen

Lege beim Domain-Anbieter einen Eintrag an, der auf deinen Server zeigt:

| Typ | Name | Wert |
| --- | --- | --- |
| `A` | `umweltbeirat` | IPv4-Adresse des Servers |
| `AAAA` | `umweltbeirat` | IPv6-Adresse des Servers (falls vorhanden) |

Prüfen, ob der Eintrag schon wirkt (kann einige Minuten bis Stunden dauern):

```bash
dig +short umweltbeirat.example.de
```

Die Ausgabe muss die IP-Adresse deines Servers zeigen.

---

## 3. Docker installieren

Falls Docker schon läuft, prüfe nur die Versionen und springe zu Schritt 4.

```bash
docker --version
docker compose version
```

Benötigt werden Docker Engine und das Compose-Plugin (Befehl `docker compose`, nicht `docker-compose`).

Installation unter Debian oder Ubuntu über das offizielle Skript:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Danach einmal ab- und wieder anmelden, damit die Gruppenzugehörigkeit greift.

Außerdem werden `git` und `sqlite3` gebraucht:

```bash
sudo apt update
sudo apt install -y git sqlite3
```

---

## 4. Repository auf den Server holen

```bash
sudo mkdir -p /opt/beirat-dabei
sudo chown $USER: /opt/beirat-dabei
git clone https://github.com/<owner>/beirat-dabei.git /opt/beirat-dabei
cd /opt/beirat-dabei
```

Alle weiteren Befehle laufen in diesem Ordner.

---

## 5. `.env` anlegen

Die `.env` enthält Schlüssel und Zugangsdaten. Sie bleibt nur auf dem Server und wird nie committet.

```bash
cp .env.example .env
chmod 600 .env
```

Zufällige Schlüssel erzeugen, je einmal pro Variable:

```bash
openssl rand -hex 32
```

Dann `.env` bearbeiten, z. B. mit `nano .env`:

```dotenv
# Adresse der Instanz
PUBLIC_URL=https://umweltbeirat.example.de/cms
TZ=Europe/Berlin

# Directus-Schlüssel (je ein eigener Wert aus openssl rand -hex 32)
KEY=...
SECRET=...

# Schlüssel zum Signieren der Magic Links (ebenfalls zufällig)
MAGIC_LINK_SECRET=...

# Datenbank
DB_CLIENT=sqlite3
DB_FILENAME=/directus/database/data.db

# Erste Admin-Person (nur für den allerersten Start, siehe Schritt 9)
ADMIN_EMAIL=admin@example.de
ADMIN_PASSWORD=...

# E-Mail-Versand
EMAIL_FROM=umweltbeirat@example.de
EMAIL_TRANSPORT=smtp
EMAIL_SMTP_HOST=smtp.example.de
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=umweltbeirat@example.de
EMAIL_SMTP_PASSWORD=...
EMAIL_SMTP_SECURE=false
```

| Variable | Erklärung |
| --- | --- |
| `PUBLIC_URL` | Die Admin-Oberfläche und API laufen unter `/cms`, das Dashboard unter `/`. |
| `KEY`, `SECRET`, `MAGIC_LINK_SECRET` | Nie wiederverwenden, nie weitergeben. Wer `MAGIC_LINK_SECRET` kennt, kann Teilnahmen fälschen. |
| `ADMIN_PASSWORD` | Mindestens 16 Zeichen. Wird nach dem ersten Start wieder entfernt. |
| `EMAIL_SMTP_SECURE` | `false` für Port 587 (STARTTLS), `true` für Port 465. |

---

## 6. `instanz.yaml` anpassen

Die Startkonfiguration liegt als Beispiel unter `examples/kremmen/`.

```bash
cp examples/kremmen/instanz.yaml instanz.yaml
nano instanz.yaml
```

Wichtige Felder:

| Feld | Bedeutung | Beispiel Kremmen |
| --- | --- | --- |
| `name` | Anzeigename im Dashboard und in E-Mails | `Beirat dabei · Umweltbeirat Kremmen` |
| `gremien` | begleitete Gremien, Name exakt wie im RIS | `Bau-/Wirtschafts- und Umweltausschuss` |
| `ris.adapter` | `oparl`, `ical`, `komfa` oder `manuell` | `komfa` |
| `ris.url` | Adresse des RIS bzw. OParl-Einstiegspunkts | Adresse des KOMFA RIS |
| `fristen.vorher_tage` | Alarm, wenn bis dahin niemand eingetragen ist | `7` |
| `fristen.nachher_tage` | Erinnerung an die Notiz | `3` |
| `notizfragen` | Fragen im Notizformular, die erste ist Pflicht | drei Fragen |
| `rollen.mitglied`, `rollen.admin` | Rollennamen in Directus | `ub`, `ub-admin` |
| `ki.themenfokus` | nur für Ausbaustufe 2 | `Umwelt, Natur, Klima` |

Die `instanz.yaml` enthält keine Geheimnisse. Sie darf in ein privates Repo deiner Gruppe, gehört aber nicht ins öffentliche Haupt-Repo.

---

## 7. Reverse Proxy und HTTPS

Der Stack lauscht nur lokal. Ein Reverse Proxy nimmt Anfragen aus dem Internet an, kümmert sich um HTTPS und leitet weiter:

| Pfad | Ziel |
| --- | --- |
| `/cms/…` | Directus (Admin-Oberfläche, API, Magic Links, iCal) |
| `/…` | Dashboard |

### Variante A: Caddy (neuer Server, empfohlen)

Caddy holt die HTTPS-Zertifikate automatisch.

```bash
sudo apt install -y caddy
sudo nano /etc/caddy/Caddyfile
```

```caddy
umweltbeirat.example.de {
    handle_path /cms/* {
        reverse_proxy 127.0.0.1:8055
    }
    handle {
        reverse_proxy 127.0.0.1:8080
    }
}
```

```bash
sudo systemctl reload caddy
```

### Variante B: vorhandener Reverse Proxy

Läuft auf dem Server schon nginx, Traefik oder ein anderer Proxy, richte dort dieselben zwei Weiterleitungen ein. Wichtig: Für `/cms` muss das Präfix vor der Weiterleitung entfernt werden, und Zertifikate kommen wie bei den anderen Diensten auf dem Server.

Die lokalen Ports `8055` (Directus) und `8080` (Dashboard) lassen sich in der `docker-compose.yml` ändern, falls sie belegt sind.

---

## 8. Stack starten

```bash
docker compose up -d
docker compose ps
```

Beide Dienste (`directus`, `dashboard`) sollten nach etwa einer Minute den Status `running` bzw. `healthy` zeigen.

Logs ansehen, falls etwas nicht startet:

```bash
docker compose logs -f directus
```

Erreichbarkeit prüfen:

```bash
curl -s https://umweltbeirat.example.de/cms/server/health
```

Erwartet wird eine Antwort mit `"status":"ok"`.

---

## 9. Erste Anmeldung als Admin

1. Im Browser `https://umweltbeirat.example.de/cms/admin` öffnen.
2. Mit `ADMIN_EMAIL` und `ADMIN_PASSWORD` aus der `.env` anmelden.
3. Im eigenen Profil das Passwort ändern.
4. `ADMIN_PASSWORD` aus der `.env` löschen. Directus braucht den Wert nur beim allerersten Start.

---

## 10. Schema, Rollen und Rechte einspielen

Collections, Felder, Rollen und Berechtigungen liegen als Code unter `directus/sync/` und werden mit [directus-sync](https://github.com/tractr/directus-sync) übertragen:

```bash
docker compose run --rm sync push
```

Der Befehl fragt nach der Admin-E-Mail und dem Passwort aus Schritt 9. Vorher zeigt `docker compose run --rm sync diff`, was sich ändern würde.

Danach sind in der Admin-Oberfläche unter *Einstellungen → Datenmodell* die Collections `einstellungen`, `gremien`, `mitglieder`, `sitzungen`, `teilnahmen`, `notizen` und `benachrichtigungen` zu sehen.

---

## 11. Instanz-Konfiguration übertragen

```bash
scripts/instanz-anwenden.sh instanz.yaml
```

Das Skript schreibt Name, Gremien, Fristen, Notizfragen, Rollennamen und RIS-Adapter nach Directus. Es kann gefahrlos mehrfach laufen.

Ab jetzt ist Directus maßgeblich: Spätere Änderungen an Fristen oder Texten erfolgen in der Admin-Oberfläche unter *Inhalte → Einstellungen*. Wird das Skript erneut ausgeführt, überschreibt es diese Werte mit denen aus der `instanz.yaml`.

---

## 12. Mitglieder anlegen

In der Admin-Oberfläche unter *Benutzerverzeichnis*:

1. *Neuer Benutzer*
2. Name und E-Mail-Adresse eintragen
3. Rolle wählen: Mitglied (z. B. `ub`) oder Admin (z. B. `ub-admin`)
4. Speichern

Von Anfang an mindestens **zwei Personen mit Admin-Rolle** anlegen, damit die Instanz nicht an einer Person hängt.

---

## 13. Funktionstest

Gehe die Punkte einmal durch, bevor du die Mitglieder informierst:

- [ ] **E-Mail-Versand:** Auf der Anmeldeseite *Passwort vergessen* für die eigene Adresse auslösen. Die E-Mail muss ankommen und darf nicht im Spam landen.
- [ ] **RIS-Abgleich:** Der erste Abgleich läuft kurz nach dem Start. Im Log prüfen: `docker compose logs directus | grep ris-abgleich`. Unter *Inhalte → Sitzungen* müssen die kommenden Sitzungen des Gremiums stehen.
- [ ] **Dashboard:** `https://umweltbeirat.example.de` öffnen und anmelden. Die Sitzungen erscheinen mit Status und Link zur Tagesordnung.
- [ ] **Eintragen:** Im Dashboard bei einer Sitzung auf *Ich nehme teil* klicken. Andere Test-Mitglieder bekommen eine Benachrichtigung.
- [ ] **Magic Link:** Einen Link aus einer Test-E-Mail im privaten Browserfenster öffnen. Die Bestätigungsseite erscheint, *Rückgängig machen* funktioniert.
- [ ] **Kalender-Abo:** Die iCal-Adresse aus dem Dashboard im Handykalender abonnieren. Die Sitzungen erscheinen.

---

## 14. Backups einrichten

Das Backup sichert die SQLite-Datenbank (konsistent per `sqlite3 .backup`) und die Uploads nach `backups/`.

Einmal von Hand testen:

```bash
scripts/backup.sh
ls -lh backups/
```

Täglich um 3 Uhr automatisch:

```bash
crontab -e
```

```cron
0 3 * * * cd /opt/beirat-dabei && scripts/backup.sh >> backups/backup.log 2>&1
```

**Wiederherstellung einmal testen,** am besten auf einem zweiten Rechner:

```bash
scripts/restore.sh backups/<datum>.tar.gz
```

Backups auf demselben Server schützen nicht vor dessen Ausfall. Kopiere sie zusätzlich regelmäßig an einen anderen Ort.

---

## Aktualisieren

```bash
cd /opt/beirat-dabei
scripts/backup.sh
git pull
docker compose pull
docker compose up -d --build
docker compose run --rm sync push
```

Vorher die Release-Hinweise lesen. Bei Änderungen an `.env.example` neue Variablen in die eigene `.env` übernehmen.

---

## Umzug auf einen anderen Server

1. Auf dem alten Server: `scripts/backup.sh` und `docker compose down`
2. Auf dem neuen Server: Schritte 1 bis 4 und 7 ausführen
3. `.env` und `instanz.yaml` vom alten Server kopieren
4. Backup kopieren und mit `scripts/restore.sh` einspielen
5. `docker compose up -d`
6. DNS-Eintrag auf die neue IP umstellen
7. Funktionstest (Schritt 13)

Bleibt die Domain gleich, funktionieren alle Links in alten E-Mails weiter.

---

## Fehlerbehebung

| Problem | Mögliche Ursache | Lösung |
| --- | --- | --- |
| Seite nicht erreichbar | DNS noch nicht verteilt, Ports 80/443 gesperrt | `dig` prüfen, Firewall prüfen (`sudo ufw status`) |
| Zertifikatsfehler | Proxy erreicht Let's Encrypt nicht | Port 80 muss von außen offen sein, Caddy-Log: `journalctl -u caddy` |
| Admin-Oberfläche lädt ohne Styles | `PUBLIC_URL` passt nicht zum Pfad | `PUBLIC_URL` muss auf `/cms` enden, Proxy muss das Präfix entfernen |
| Keine E-Mails | SMTP-Daten falsch, Port blockiert | `docker compose logs directus | grep -i mail`, `EMAIL_SMTP_SECURE` zu Port prüfen |
| E-Mails im Spam | fehlende SPF/DKIM-Einträge der Absenderdomain | beim Mail-Anbieter SPF und DKIM einrichten |
| Keine Sitzungen | falscher Gremienname oder Adapter | Gremienname exakt wie im RIS, `docker compose logs directus | grep ris-abgleich` |
| `database is locked` | Datenbankdatei im laufenden Betrieb kopiert | nur `scripts/backup.sh` verwenden |
| Magic Links ungültig | `MAGIC_LINK_SECRET` geändert | Alte Links verlieren damit ihre Gültigkeit, neue E-Mails abwarten |

Weitere Fragen gern als [Issue](https://github.com/<owner>/beirat-dabei/issues).
