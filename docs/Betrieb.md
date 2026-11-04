# Beirat dabei – Betriebsanleitung

Für alle, die eine Instanz betreuen, ohne selbst zu programmieren. Die Anleitung geht davon aus, dass jemand den Server einmal eingerichtet hat (siehe [Installation](installation.md)). Befehle gibst du im Terminal des Servers im Ordner `beirat-dabei` ein. Docker-Befehle brauchen `sudo`, außer dein Benutzer ist in der Gruppe `docker`.

**Die wichtigsten Adressen** (mit der `PUBLIC_URL` aus der `.env`):

| Adresse | Wofür | Wer |
| --- | --- | --- |
| `PUBLIC_URL/dashboard/` | Sitzungen, Teilnahme, Notizen, Kalender-Abo | alle Mitglieder |
| `PUBLIC_URL/dashboard/oeffentlich.html` | Termine und Unterlagen | jeder, ohne Anmeldung |
| `PUBLIC_URL/admin` | Verwaltung | Administrierende und das technische Konto |

## Inhalt

1. [Was läuft da eigentlich?](#was-läuft-da-eigentlich)
2. [Stack starten, stoppen, ansehen](#stack-starten-stoppen-ansehen)
3. [Erste Einrichtung](#erste-einrichtung)
4. [Mitglied anlegen, sperren, entfernen](#mitglied-anlegen-sperren-entfernen)
5. [Gremium und Sitzung pflegen](#gremium-und-sitzung-pflegen)
6. [Einstellungen](#einstellungen)
7. [RIS-Abgleich und Benachrichtigungen umstellen](#ris-abgleich-und-benachrichtigungen-umstellen)
8. [Aktualisieren](#aktualisieren)
9. [Backup und Wiederherstellung](#backup-und-wiederherstellung)
10. [Absicherung](#absicherung)
11. [Übergabe an neue Administrierende](#übergabe-an-neue-administrierende)
12. [Häufige Probleme](#häufige-probleme)

## Was läuft da eigentlich?

Zwei Container:

- **app**: die Anwendung mit Datenbank, Verwaltungsoberfläche und Anmeldung. Sie holt die Sitzungen aus dem Ratsinformationssystem (RIS), prüft einmal täglich um 7 Uhr die Benachrichtigungsregeln und verschickt die Mails.
- **web**: der Webserver (Caddy). Er liefert das Dashboard aus und reicht alles andere an die Anwendung weiter.

Alle Daten liegen im Ordner `data/` (eine Datenbankdatei `beirat.db` plus `uploads/`). Die Zugangsdaten und Schlüssel stehen in der Datei `.env`. Sie ist geheim und gehört **nicht** ins Git.

## Stack starten, stoppen, ansehen

| Was | Befehl |
| --- | --- |
| Starten (und Änderungen an `.env` übernehmen) | `docker compose up -d` |
| Stoppen | `docker compose stop` |
| Neustarten | `docker compose restart app` |
| Läuft alles? | `docker compose ps` (`app` sollte `healthy` sein) |
| Meldungen ansehen (letzte 100 Zeilen) | `docker compose logs --tail 100 app` |
| Meldungen live mitlesen (Abbruch mit Strg+C) | `docker compose logs -f app` |

In den Meldungen erkennst du die Arbeit des Systems an dem Wort `beirat-dabei:`, zum Beispiel:

```
beirat-dabei: RIS-Abgleich (scharf): 1 angelegt, 0 geändert
beirat-dabei: Regellauf (scharf): 3 fällig, 3 gesendet, 0 fehlgeschlagen
```

## Erste Einrichtung

Den Server richtet die [Installationsanleitung](installation.md) ein. Danach:

1. **Das technische Administratorkonto anlegen.** Rufe `PUBLIC_URL/admin` auf. Beim ersten Aufruf fragt die Seite nach Name, E-Mail-Adresse und Passwort. Diese erste Person wird das **technische Administratorkonto** (im Formular ist die Rolle vorgewählt, prüfe sie nach dem Anlegen): Es darf Mitglieder anlegen und ändern, ist aber selbst kein Mitglied und bekommt keine Mails. Wähle ein langes Passwort und bewahre es sicher auf.
2. **Einstellungen** ausfüllen, **Gremium** und **Mitglieder** anlegen, wie in den folgenden Abschnitten beschrieben. Formulare speichern erst, wenn du oben rechts auf **Speichern** klickst. Ein ungespeichertes Gremium war bei einer Installation der Grund für „0 angelegt“.
3. **Benachrichtigungen bleiben zunächst im Trockenmodus** (siehe [unten](#ris-abgleich-und-benachrichtigungen-umstellen)). Erst wenn die Sitzungen stimmen, schaltest du sie scharf.

Impressum und Datenschutzerklärung trägt die Anwendung beim ersten Start als Vorlage in die Einstellungen ein. Du musst sie noch ausfüllen (siehe [unten](#impressum-und-datenschutzerklärung)).

## Mitglied anlegen, sperren, entfernen

Mitglieder legt **nur das technische Administratorkonto** an, ändert und löscht sie. Die Rolle *Admin* darf die Liste ansehen, aber nichts ändern: Sonst könnte sich jede Person mit diesem Recht zum Administrator machen (siehe [SECURITY.md](../SECURITY.md)).

**Anlegen:** Verwaltung → **Mitglieder** → Neu.

| Feld | Eintrag |
| --- | --- |
| Name | **Pflicht.** So erscheint die Person im Dashboard und in den Mails. |
| E-Mail | die Adresse, an die die Benachrichtigungen gehen |
| Passwort | Das Formular verlangt eins. Vergib irgendein langes Zufallspasswort und teile es **nicht** mit. Das Mitglied setzt sich sein Passwort selbst über „Passwort vergessen“ im Dashboard. Das funktioniert nur, wenn der Mailversand eingerichtet ist. |
| Rolle | *Mitglied* für Mitglieder, *Admin* für Administrierende. *Technisches Administratorkonto* nur für das eigene Konto. |
| Status | *Aktiv* |

Das Mitglied meldet sich unter `PUBLIC_URL/dashboard/` an. Mitglieder brauchen **keinen** Zugang zur Verwaltung. Sie arbeiten nur im Dashboard und über die Links in den Mails. Nach fünf falschen Anmeldeversuchen ist ein Konto zehn Minuten gesperrt.

**Sperren** (zum Beispiel bei Ausscheiden): beim Mitglied den Status auf *Gesperrt* setzen. Die Person kann sich nicht mehr anmelden, bekommt keine Mails mehr, und ihr Kalender-Abo hört auf zu funktionieren. Ihre bisherigen Eintragungen und Notizen bleiben erhalten.

**Löschen** entfernt das Konto. Eintragungen bleiben als Verweis auf ein nicht mehr vorhandenes Konto stehen. Im Zweifel lieber sperren.

## Gremium und Sitzung pflegen

### Gremium

Ein **Gremium** ist der Ausschuss oder das Organ, dessen Sitzungen der Beirat verfolgt, zum Beispiel der Bauausschuss. Es ist **nicht der Beirat selbst**: Jeder Beirat hat seine eigene Instanz, und in der Instanz steht, welche Gremien er begleitet. Viele Beiräte begleiten nur eines. Ein Beirat kann aber mehrere begleiten. Dann kommen die Sitzungen aller Gremien ins Dashboard, und es erscheint eine Auswahl zum Filtern. Auch der RIS-Abgleich ordnet die Sitzungen über das Gremium zu.

Verwaltung → Inhalt → **Gremien**.

| Feld | Bedeutung |
| --- | --- |
| Name | Anzeigename, erscheint im Dashboard und in den Mails |
| RIS-Kennung | der Name des Gremiums **genau so, wie ihn das RIS anzeigt**, zum Beispiel `Bauausschuss`. Nur damit findet der Abgleich die Sitzungen. Bei Handpflege leer lassen. Beim KOMFA-Adapter ist es der **Sitzungstitel im Kalender** ohne „Stadt …, “, nicht der Name im Gremienfilter des RIS. Beide können abweichen. Ermitteln mit dem `curl`-Befehl aus der [Installationsanleitung](installation.md#12-ris-kennung-des-gremiums-ermitteln). |
| Aktiv | nur aktive Gremien werden mit dem RIS abgeglichen |

### Sitzung von Hand

Der RIS-Abgleich legt Sitzungen automatisch an. Von Hand brauchst du es, wenn das RIS ausfällt oder (noch) nicht angebunden ist: Inhalt → **Sitzungen** → Neu.

| Feld | Bedeutung |
| --- | --- |
| Gremium | zu welchem Gremium die Sitzung gehört |
| Beginn | Datum und Uhrzeit. Die Oberfläche zeigt die Zeit deines Browsers an, in Deutschland also die deutsche Ortszeit. |
| Ort | wird im Dashboard, in Mails und im Kalender angezeigt |
| Tagesordnung veröffentlicht | Haken setzen, sobald die Tagesordnung vorliegt. Das löst die Mail „Tagesordnung veröffentlicht“ aus. |
| Link zur Tagesordnung | muss mit `https://` beginnen |
| Abgesagt | Haken setzen, wenn die Sitzung ausfällt. Eingetragene werden informiert. |
| RIS-Kennung der Sitzung, Link zur Sitzung im RIS | leer lassen, das füllt der Abgleich |

**Wichtig bei RIS-Anbindung:** Sitzungen, die aus dem RIS stammen (RIS-Kennung ist gefüllt), gleicht der Abgleich mit dem RIS ab und **überschreibt dort geänderten Beginn und Ort** wieder. Willst du etwas ausprobieren, lege dafür eine eigene Sitzung ohne RIS-Kennung an. Die lässt der Abgleich in Ruhe.

**Verschieben:** einfach den Beginn ändern. Bei Handpflege werden die Eingetragenen dabei nicht automatisch informiert, schreibe ihnen kurz selbst. Beim RIS-Abgleich erledigt das System das.

**Nicht löschen:** Eine abgesagte oder falsche Sitzung besser auf *Abgesagt* setzen, statt sie zu löschen. Eintragungen und Notizen verweisen auf die Sitzung.

**Was die Fristen auslösen,** steht in der README unter „Benachrichtigungsregeln“. Kurz: sieben Tage vor der Sitzung geht eine Erinnerung raus, wenn niemand eingetragen ist, und drei Tage danach eine Bitte um die Notiz an die Teilnehmenden. Austragen setzt das Ende der Teilnahme und löst sofort einen Regellauf aus. Eine Nachricht gibt es nur, wenn sich in der letzten Woche vor der Sitzung die letzte Person austrägt. Austragen außerhalb der Frist bleibt still, das ist so entschieden.

### Logo, Name und Farbe

Name und Logo erscheinen in der Kopfzeile und auf der Anmeldeseite, auch ohne Anmeldung. Alles stellst du in den **Einstellungen** ein: Name, Logo (Bild hochladen) und **Akzentfarbe** (Hex-Wert wie `#1f4a2e`, leer lassen für das Standardgrün). Die Akzentfarbe färbt Kopfzeile, Knöpfe und Markierungen, im hellen wie im dunklen Modus. Wähle einen eher dunklen Ton, weil darauf weiße Schrift steht. Bei sehr hellen Farben wechselt die Schrift automatisch auf dunkel. Die Änderung gilt nach spätestens fünf Minuten für alle (Zwischenspeicher). Solange keins eingestellt ist, erscheint ein neutrales Platzhalter-Symbol. Der Absendername der Mails steht dagegen in der `.env` (`EMAIL_FROM_NAME`).

### Öffentliche Unterlagen

Unter `PUBLIC_URL/dashboard/oeffentlich.html` sieht **jeder ohne Anmeldung** die nächsten Sitzungstermine mit Link zur Tagesordnung und die veröffentlichten Unterlagen: Geschäftsordnung, Stellungnahmen, Tätigkeitsberichte und weitere Dokumente. Die Seite zeigt keine Mitglieder und keine Notizen.

Unterlagen pflegst du in der Verwaltung unter Inhalt → **Dokumente**:

| Feld | Bedeutung |
| --- | --- |
| Titel | so erscheint das Dokument öffentlich |
| Kategorie | Geschäftsordnung, Stellungnahme, Tätigkeitsbericht oder Weitere Unterlagen |
| Datum | Datum des Dokuments, die neuesten stehen oben |
| Beschreibung | optional, ein bis zwei Sätze |
| Datei | die Datei hochladen (PDF empfohlen; auch PNG, JPEG, Word und ODT) |
| Veröffentlicht | **nur mit Haken** ist das Dokument öffentlich. Ohne Haken bleibt es ein Entwurf, den niemand ohne Zugang sieht. |

Prüfe vor dem Veröffentlichen, dass im Dokument nichts Internes steht (Namen, Mailadressen, Entwurfsvermerke). Wer die Adresse einer Datei kennt, kann sie abrufen, solange sie veröffentlicht ist. Entwürfe sind nicht abrufbar.

### Impressum und Datenschutzerklärung

Beide Seiten sind von jeder Seite der Website über die Fußzeile erreichbar (`impressum.html`, `datenschutz.html`) und stehen auch in den Mails. Die Texte pflegst du in den **Einstellungen** in den Feldern *Impressum* und *Datenschutzerklärung*. Es ist Markdown: `#` und `##` für Überschriften, `-` für Listen, `**fett**` und `[Text](https://…)` für Links.

Beim ersten Start trägt die Anwendung **Vorlagen** ein (`docs/vorlagen/`). In den Vorlagen stehen Angaben in `[eckigen Klammern]`, die du ausfüllen musst. Auf der Website erscheinen sie gelb markiert, damit man sie nicht übersieht. **Eine Vorlage ist keine Rechtsberatung.** Lass die Texte vor der Veröffentlichung von der Datenschutzbeauftragten Person oder einer Rechtsberatung prüfen und passe sie an deinen Hoster, deinen Mailanbieter und deine Löschfristen an.

**Cookie-Hinweis:** Die Website setzt im öffentlichen Bereich keine Cookies. Nach der Anmeldung entsteht ein einziges, technisch notwendiges Sitzungs-Cookie (14 Tage, nicht für Skripte lesbar). Dafür ist keine Einwilligung nötig, also kein Cookie-Banner. Das ändert sich, sobald jemand Statistik, eingebettete Videos, Karten oder Schriftarten von fremden Servern einbaut. Dann braucht die Seite eine Einwilligungsabfrage.

**Aufbewahrung:** Das Anwendungsprotokoll des Servers ist auf etwa 30 MB begrenzt. Es enthält aufgerufene Adressen, auch persönliche Links. Wer Zugriff auf den Server hat, kann sie lesen. Eine automatische Löschfrist für Sitzungen und Notizen gibt es nicht.

### Notizen löschen

Teilnehmende löschen eine Notiz im Dashboard über „Notiz löschen“ (mit Sicherheitsabfrage). Weil die Notiz allen Teilnehmenden einer Sitzung gehört, verschwindet sie für alle. Das Löschen ist endgültig. Die Erinnerungsmail „Notiz fehlt“ kommt danach nicht noch einmal. Administrierende können Notizen außerdem in der Verwaltung unter Inhalt → Notizen löschen, auch wenn sie bei der Sitzung nicht dabei waren.

## Einstellungen

Verwaltung → **Einstellungen** (es gibt genau einen Eintrag).

| Feld | Bedeutung |
| --- | --- |
| Name der Instanz | Anzeigename, zum Beispiel `Seniorenbeirat Musterstadt` |
| Logo | Bild für die Kopfzeile |
| Akzentfarbe | Hauptfarbe des Dashboards als Hex-Wert, leer = Standardgrün |
| Frist vor der Sitzung (Tage) | für die Erinnerung (Standard 7) |
| Frist nach der Sitzung (Tage) | für die Bitte um die Notiz (Standard 3) |
| Zeitzone | `Europe/Berlin` |
| Version der Kalender-Abos | Zahl erhöhen, um **alle** Kalender-Abo-Adressen ungültig zu machen (zum Beispiel wenn eine Adresse unbefugt weitergegeben wurde). Die Mitglieder holen sich danach im Dashboard die neue Adresse. |
| RIS-Adapter | `komfa` für ein KOMFA RIS, `manuell` ohne Abgleich |
| Adresse des RIS | zum Beispiel `https://ris.musterstadt.example` |
| Fragen im Notizformular | die Fragen als Liste (JSON). Jede Frage hat `schluessel`, `frage`, `typ` (`ja-nein` oder `text`) und `pflicht`. Die Frage mit dem Schlüssel `relevant` muss bleiben. Leer lassen für die Standardfragen. |
| Impressum, Datenschutzerklärung | Markdown, siehe oben |
| Themenfokus | derzeit ohne Wirkung (für die spätere KI-Vorsortierung gedacht) |

Beispiel für die Notizfragen:

```json
[
  { "schluessel": "relevant", "frage": "War etwas Relevantes für den Beirat dabei?", "typ": "ja-nein", "pflicht": true },
  { "schluessel": "tops", "frage": "Welche TOPs waren umweltrelevant?", "typ": "text", "pflicht": false },
  { "schluessel": "beschluesse", "frage": "Was wurde beschlossen oder vertagt?", "typ": "text", "pflicht": false }
]
```

Den Absender der Mails legen `EMAIL_FROM` und `EMAIL_FROM_NAME` in der `.env` fest.

## RIS-Abgleich und Benachrichtigungen umstellen

Zwei Schalter in der `.env` steuern, was das System tut:

| Variable | Aufgabe |
| --- | --- |
| `RIS_MODUS` | Sitzungen aus dem RIS holen (dreimal täglich) |
| `REGELN_MODUS` | Mails nach den Regeln verschicken (täglich 7 Uhr und nach Änderungen an Teilnahmen) |

| Stufe | Wirkung |
| --- | --- |
| `aus` | tut nichts |
| `trocken` | **nur ins Protokoll schreiben**, was passieren würde. Nichts wird geändert, nichts verschickt. |
| `scharf` | arbeitet wirklich |

Änderungen an der `.env` übernimmst du mit `docker compose up -d`. Ein bloßes `restart` liest die `.env` nicht neu ein. Prüfe danach, was wirklich gilt: `docker compose exec app printenv RIS_MODUS RIS_CRON REGELN_MODUS REGELN_CRON`. Jede Variable darf nur **einmal** in der `.env` stehen.

**Empfohlene Reihenfolge bei der Inbetriebnahme:**

1. Beide Schalter auf `trocken` lassen. In `docker compose logs --tail 200 app` stehen Zeilen mit `[trocken]`: welche Sitzungen angelegt würden und welche Mails fällig wären. Die Zusammenfassung lautet im Trockenmodus **immer** `0 angelegt, 0 geändert`. Ob etwas gefunden wurde, zeigen nur die `[trocken]`-Zeilen.
2. Prüfen, ob das stimmt: mit RIS-Adapter und Adresse in den Einstellungen und der RIS-Kennung am Gremium.
3. `RIS_MODUS=scharf` setzen und `docker compose up -d`. Nach dem nächsten Lauf (um 6:15, 12:15 oder 18:15 Uhr) stehen die Sitzungen im Dashboard. Der Abgleich holt auch die vergangenen 45 Tage (`RIS_RUECKBLICK_TAGE`), damit die letzte Sitzung dasteht und Notizen nachträglich möglich sind. Zum Ausprobieren kannst du für den ersten Lauf `RIS_CRON='* * * * *'` setzen (jede Minute) und die Zeile danach wieder entfernen. Für den Regeltest verkürzt du analog `REGELN_CRON`.
4. Das Dashboard kontrollieren. Dann erst `REGELN_MODUS=scharf` setzen und wieder `docker compose up -d`.

> **Vorsicht beim Scharfschalten der Regeln:** Gleich danach gehen alle gerade fälligen Mails raus, zum Beispiel „Tagesordnung veröffentlicht“ zu allem, was schon im System steht. Mails verschickt das System nur einmal pro Anlass (Versandprotokoll), du kannst sie aber nicht zurückholen. Informiere die Mitglieder vorher.

Zum Testen des Mailversands ohne Wirkung auf alle: lege vorher nur dich selbst als Mitglied an.

**Neue Mitglieder später aufnehmen:** Der Regellauf arbeitet nach Zustand und Versandprotokoll pro Person. Neue Mitglieder bekommen offene Hinweise (Regeln 1 und 2) zu bestehenden Sitzungen beim nächsten Lauf nachträglich. Lösche deshalb keine Sitzungen. Reihenfolge: erst `REGELN_MODUS=trocken`, dann die Mitglieder anlegen, das Protokoll prüfen, dann `scharf`.

## Aktualisieren

Vorher immer ein Backup machen (`scripts/backup.sh`). Dann:

```bash
git pull
docker compose up -d --build
```

Beim Start spielt die Anwendung neue Datenbankänderungen (Migrationen) selbst ein. Prüfe danach im Protokoll (`docker compose logs --tail 100 app`), dass `Migrated:` ohne Fehler erscheint und `docker compose ps` `healthy` zeigt. Die Version der Anwendung steht fest im Repository, Updates führst du bewusst durch.

Nach einem fehlgeschlagenen Update: Meldungen ansehen. Notfalls zum letzten Backup zurück (`scripts/restore.sh`) und die alte Version mit `git checkout <Version>` und `docker compose up -d --build` wieder einspielen.

## Backup und Wiederherstellung

```bash
scripts/backup.sh
```

sichert die Datenbank (konsistent auch im laufenden Betrieb, wenn `sqlite3` auf dem Server installiert ist) und die Uploads in ein Archiv unter `backups/`. Die neuesten 14 bleiben erhalten. Die `.env` ist **nicht** enthalten: Bewahre sie getrennt und sicher auf (Passwortmanager). Ohne `MAGIC_LINK_SECRET` sind alle Links aus alten Mails und alle Kalender-Abos nach einer Wiederherstellung ungültig. Mitglieder müssen sich danach neu anmelden, wenn sich `PAYLOAD_SECRET` ändert.

Regelmäßig, zum Beispiel täglich um 3:15 Uhr (`crontab -e`):

```
15 3 * * * cd /pfad/zu/beirat-dabei && scripts/backup.sh >> backups/backup.log 2>&1
```

Kopiere die Archive zusätzlich an einen anderen Ort, **verschlüsselt** (siehe [Absicherung](#absicherung)).

**Wiederherstellen:**

```bash
scripts/restore.sh backups/beirat-dabei-<Zeit>.tar.gz
```

Das Skript prüft das Archiv, fragt nach, stoppt die Anwendung, verschiebt die bisherigen Daten nach `data/vorher-<Zeit>` (nichts wird gelöscht) und spielt die Sicherung ein. Danach `docker compose up -d`. Führe die Wiederherstellung einmal zur Probe aus, bevor du sie brauchst, am besten auf einem zweiten Rechner.

## Absicherung

Diese Punkte gehören zu jeder Instanz, die aus dem Internet erreichbar ist.

- **Anfragen begrenzen.** Die Anwendung bremst „Passwort vergessen“ nicht. Wer die Adresse eines Mitglieds kennt, könnte ihm beliebig viele Mails schicken lassen. Anmeldeversuche begrenzt Payload pro Konto (5 Fehlversuche, dann 10 Minuten Sperre), nicht pro Absender. Begrenze deshalb am Reverse Proxy, zum Beispiel in nginx:

  ```nginx
  limit_req_zone $binary_remote_addr zone=bd_auth:10m rate=10r/m;
  # im server-Block, vor dem allgemeinen location /:
  location ~ ^/api/users/(login|forgot-password) {
      limit_req zone=bd_auth burst=5 nodelay;
      proxy_pass http://127.0.0.1:8055;   # wie in der übrigen Konfiguration
  }
  ```
- **Header.** Der `Caddyfile` setzt für das Dashboard `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options` und eine Content-Security-Policy. HTTPS und `Strict-Transport-Security` setzt der vorgeschaltete Proxy.
- **Links in Mails sind Zugangsdaten.** Wer einen Link aus einer Mail hat, kann damit die jeweilige Aktion ausführen, bis er abläuft (bis `MAGIC_LINK_NACHLAUF_TAGE` nach der Sitzung). Weiterleiten oder Posten in einem Chat gibt diese Möglichkeit weiter. Das Kalender-Abo ist dauerhaft gültig, bis die Version der Kalender-Abos erhöht wird.
- **Backups enthalten personenbezogene Daten** (Namen, Adressen, Notizen). `scripts/backup.sh` legt sie nur mit eingeschränkten Rechten ab. Kopien außer Haus verschlüsseln, zum Beispiel mit `age` oder `gpg`.
- **Geheimnisse.** Die `.env` nur auf dem Server, mit `chmod 600`. `PAYLOAD_SECRET` und `MAGIC_LINK_SECRET` nie weitergeben. Ändert sich `MAGIC_LINK_SECRET`, werden alle ausgegebenen Links und Kalender-Abos ungültig.
- **Updates.** Die Version der Bibliotheken steht fest im Repository. Beobachte Sicherheitsmeldungen und aktualisiere bewusst (siehe „Aktualisieren“).

## Übergabe an neue Administrierende

1. Neue Person mit dem technischen Administratorkonto in der Verwaltung als Mitglied mit Rolle *Admin* anlegen. Das technische Konto und sein Passwort gehören zur Übergabe.
2. Ihr diese Anleitung geben.
3. Den Zugang zum Server, die `.env` und die Mail-Zugangsdaten (SMTP-Konto des Beirats) sicher übergeben.

## Häufige Probleme

| Problem | Ursache und Abhilfe |
| --- | --- |
| **`docker compose ps` zeigt `app` als `unhealthy` oder `Restarting`** | `docker compose logs --tail 100 app` ansehen. Häufig fehlt ein Wert in der `.env` (`PAYLOAD_SECRET`, `MAGIC_LINK_SECRET`, `PUBLIC_URL`) oder `data/` gehört nicht UID 1000 (`sudo chown -R 1000:1000 data`). |
| **`permission denied … docker.sock`** | Docker-Befehle mit `sudo` ausführen oder den Benutzer in die Gruppe `docker` aufnehmen. |
| **Dashboard zeigt „Lade …“ oder bleibt leer** | `docker compose ps` prüfen, beide Container müssen laufen. Meldungen mit `docker compose logs --tail 100 app` und `… web` ansehen. |
| **nginx antwortet mit `404` oder `502`** | `systemctl reload nginx` vergessen, oder `PORT` in der `.env` stimmt nicht mit `proxy_pass` überein. |
| **Die Anmeldung geht, aber danach landet man wieder im Login** | `COOKIE_SECURE=true`, die Seite wird aber ohne HTTPS aufgerufen. Im Betrieb immer über HTTPS gehen. Nur für lokale Tests `false` setzen. |
| **„Die E-Mail-Adresse oder das Passwort sind nicht korrekt“** | Tippfehler, oder das Konto ist gesperrt. Nach fünf Fehlversuchen ist es zehn Minuten gesperrt. |
| **„Dieses Konto ist gesperrt“** | Status des Mitglieds steht auf *Gesperrt*. |
| **„Dieses Konto ist kein aktives Mitglied“** | Die Person hat die Rolle *Technisches Administratorkonto* (kein Mitglied) oder ist gesperrt. Lege für dich ein eigenes Mitglied an. |
| **Mails kommen nicht an** | 1. Steht `REGELN_MODUS` auf `scharf`? Bei `trocken` wird nichts verschickt. 2. Sind `EMAIL_SMTP_HOST` und die Zugangsdaten gesetzt? **Ohne `EMAIL_SMTP_HOST` schreibt die Anwendung die Mails nur ins Protokoll** (`[mail] an …`). 3. In den Meldungen nach `Versand … fehlgeschlagen` suchen: meist falsche SMTP-Zugangsdaten oder Port. Fehlgeschlagene Mails werden beim nächsten Lauf wiederholt. 4. `EMAIL_FROM` muss eine Adresse sein, die der Anbieter für das Konto zulässt (Absender-Prüfung). 5. Spam-Ordner. Eine Prüfung des SMTP-Zugangs steht in der [Installationsanleitung](installation.md#15-e-mail-versand-prüfen). |
| **„Passwort vergessen“ liefert keine Mail** | Das Dashboard antwortet immer gleich, auch bei unbekannter Adresse. Prüfe, ob das Konto mit genau dieser Adresse existiert, und die Hinweise zu „Mails kommen nicht an“. |
| **Ein Link in der Mail sagt „abgelaufen“** | Links aus Mails gelten bis 14 Tage nach der Sitzung, der „Rückgängig“-Link nach einem Klick nur 30 Minuten. Das Mitglied meldet sich im Dashboard an und trägt sich dort ein. |
| **Der Abgleich legt keine Sitzungen an** | 1. `RIS_MODUS` ist `trocken` oder `aus`. 2. In den Einstellungen fehlen RIS-Adapter `komfa` oder die Adresse des RIS. 3. Die RIS-Kennung am Gremium stimmt nicht exakt mit dem Titel im RIS-Kalender überein (auf Schrägstriche und Bindestriche achten). 4. Das Gremium ist nicht *Aktiv*, oder die Änderung am Gremium wurde nicht gespeichert (Speichern oben rechts). Die Meldungen zeigen `RIS-Abgleich übersprungen` oder `[trocken] RIS-Abgleich: …`. |
| **Eine Sitzung wurde als abgesagt markiert, obwohl sie stattfindet** | Das System markiert eine kommende Sitzung als abgesagt, wenn sie bei vollständigem Abruf im RIS fehlt. Prüfe das RIS. Wenn die Sitzung dort steht, nimm im Eintrag den Haken *Abgesagt* wieder heraus. Zurückgenommen wird nichts automatisch. |
| **Hinweis „Notiz fehlt“** | Erscheint nur, wenn mindestens eine Person eingetragen war, bis 90 Tage nach der Sitzung. Sitzungen ohne Eintragung stehen als „Nicht besetzt“ im Dashboard. |
| **Eine `.env`-Änderung wirkt nicht** | `restart` statt `up -d` benutzt, oder die Variable steht doppelt in der `.env`. Prüfen mit `docker compose exec app printenv …`. |
| **Im Dashboard steht „Mitglied“ statt eines Namens** | Beim Mitglied fehlt der Name. |
| **Nach einem Update läuft nichts mehr** | Meldungen ansehen, dann Backup einspielen und alte Version wiederherstellen (siehe „Aktualisieren“). |
| **Port belegt beim Start** | In der `.env` einen anderen `PORT` setzen und den Reverse Proxy darauf zeigen lassen. |

Kommst du nicht weiter: Meldungen sichern (`docker compose logs --tail 300 app > fehler.txt`, ohne Passwörter weiterzugeben) und im Repository ein Issue anlegen.
