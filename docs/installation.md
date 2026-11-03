# Installation

Schritt-für-Schritt-Anleitung, um eine Instanz von *Beirat dabei* auf einem Linux-Server mit Docker und einem vorhandenen nginx einzurichten.

> **Stand:** Die Anleitung beschreibt den Aufbau mit Payload CMS. Der Docker-Stack ist lokal getestet (Start, Migration, Anmeldung, Passwort-Reset, Links, Regellauf im Trockenmodus). Die Schritte auf einem echten Server mit nginx, HTTPS und SMTP (8 bis 18) werden mit der ersten Installation erprobt. Fehler bitte als Issue melden.

Beispielwerte: Subdomain `umweltbeirat.example.de`, lokaler Port `8056`. Ersetze sie durch deine eigenen.

---

## Überblick

| Schritt | Was passiert |
| --- | --- |
| 1 | Voraussetzungen prüfen |
| 2 | Subdomain per DNS auf den Server zeigen lassen |
| 3 | Repository auf den Server holen |
| 4 | Freien Port wählen |
| 5 | `.env` anlegen |
| 6 | Datenordner mit den richtigen Rechten anlegen |
| 7 | Stack bauen und starten |
| 8 | nginx für die Subdomain einrichten (HTTP) |
| 9 | HTTPS-Zertifikat holen |
| 10 | Technisches Administratorkonto anlegen |
| 11 | Einstellungen eintragen |
| 12 | RIS-Kennung des Gremiums ermitteln |
| 13 | Gremium anlegen |
| 14 | RIS-Abgleich testen und scharf schalten |
| 15 | E-Mail-Versand prüfen |
| 16 | Erstes Mitglied anlegen |
| 17 | Benachrichtigungsregeln testen und scharf schalten |
| 18 | Backups |

Am Ende: [Fehlerbehebung](#fehlerbehebung).

**Allgemein:**

- Alle `docker`-Befehle mit `sudo` ausführen, außer dein Benutzer ist Mitglied der Gruppe `docker`. Diese Mitgliedschaft entspricht praktisch Root-Rechten. `sudo` ist die sicherere Wahl.
- Alle Befehle laufen im Repo-Wurzelverzeichnis, z. B. `~/beirat-dabei`, wenn nichts anderes angegeben ist.
- Auf dem Server muss **kein Node** installiert sein. Gebaut wird im Container (`docker compose up --build`).

---

## 1. Voraussetzungen prüfen

| Was | Hinweis |
| --- | --- |
| Linux-Server mit Docker Engine und Compose-Plugin | `sudo docker compose version` muss funktionieren |
| etwa 2 GB Arbeitsspeicher und 2 GB freier Platz | der Build braucht kurzzeitig mehr, im Betrieb braucht die Anwendung rund 250 MB |
| nginx auf dem Server als Reverse Proxy | andere Dienste dürfen dort schon laufen, sie bleiben unberührt |
| certbot mit nginx-Plugin | für HTTPS (Schritt 9). Läuft schon eine Seite mit Let's Encrypt, ist er meist vorhanden |
| `git` | zum Holen des Repositorys |
| eine Subdomain, deren DNS du verwalten kannst | z. B. beim Domain-Anbieter |
| ein SMTP-Konto für den Versand | am besten ein Postfach, das dem Beirat gehört, kein persönliches |

**Öffentliche IP-Adressen des Servers notieren** (auf dem Server ausführen):

```bash
curl -4 -s https://ifconfig.me; echo
curl -6 -s https://ifconfig.me; echo
```

Die zweite Zeile bleibt leer, wenn der Server kein IPv6 hat.

---

## 2. Subdomain per DNS auf den Server zeigen lassen

### Weiterleitung oder DNS-Eintrag?

Beim Domain-Anbieter kann eine Subdomain auf zwei Arten auf einen anderen Server zeigen:

**Weiterleitung, die ungeeignet ist:**
```
Browser → Webserver des Anbieters → „geh woanders hin“ → Browser → eigener Server
```
Der Anbieter ist bei jedem Aufruf beteiligt, und der Browser zeigt danach eine andere Adresse. Links in E-Mails und das HTTPS-Zertifikat passen dann nicht zur Subdomain.

**DNS-Eintrag, der richtige Weg:**
```
Browser: „Welche IP hat umweltbeirat.example.de?“
Nameserver des Anbieters: „Die IP deines Servers“
Browser → direkt zu deinem Server
```
Der Anbieter liefert nur die Adresse, wie ein Telefonbuch. nginx auf deinem Server erkennt am Namen, wohin die Anfrage gehört.

### Einrichten

In der DNS-Verwaltung des Anbieters:

| Typ | Name | Wert |
| --- | --- | --- |
| `A` | `umweltbeirat` | IPv4-Adresse des Servers |
| `AAAA` | `umweltbeirat` | IPv6-Adresse des Servers (optional) |

Ist die Subdomain beim Anbieter zusätzlich als Weiterleitung angelegt, diese Weiterleitung löschen.

### Prüfen

```bash
getent ahosts umweltbeirat.example.de | awk '{print $1}' | sort -u
```

Die Ausgabe darf nur die Adressen deines Servers enthalten. Steht dort eine fremde Adresse, ist beim Anbieter ein alter Eintrag übrig.

```bash
curl -sI http://umweltbeirat.example.de | grep -iE '^(HTTP|location|server)'
```

Erscheint keine `Location:`-Zeile, gibt es keine Weiterleitung. Solange nginx die Subdomain noch nicht kennt, antwortet er mit seinem Standardeintrag. Ein `200` oder `404` von deinem nginx ist an dieser Stelle normal.

---

## 3. Repository auf den Server holen

```bash
cd ~
git clone https://github.com/avenqo/beirat-dabei.git
cd beirat-dabei
```

---

## 4. Freien Port wählen

Der Stack lauscht lokal auf einem Port, an den nginx weiterleitet. Laufen auf dem Server schon andere Dienste, ist der Standardport `8055` oft belegt.

```bash
sudo ss -tlnp | grep -E ':80[0-9]{2}\b'
```

Einen Port wählen, der dort **nicht** auftaucht, z. B. `8056`. Er wird in Schritt 5 in der `.env` eingetragen. In der `docker-compose.yml` ist der Port beim Dienst `web` nur an `127.0.0.1` gebunden, der Stack ist also nur über nginx erreichbar und nicht direkt über `http://<Server-IP>:<Port>`.

---

## 5. `.env` anlegen

```bash
cp .env.example .env
chmod 600 .env
openssl rand -hex 32    # zweimal ausführen: einmal für PAYLOAD_SECRET, einmal für MAGIC_LINK_SECRET
nano .env
```

| Variable | Wert |
| --- | --- |
| `PUBLIC_URL` | `https://umweltbeirat.example.de`, ohne Schrägstrich am Ende |
| `PORT` | der Port aus Schritt 4 |
| `COOKIE_SECURE` | `true` (nicht ändern, wenn die Instanz über HTTPS läuft) |
| `PAYLOAD_SECRET`, `MAGIC_LINK_SECRET` | die beiden Zufallswerte, **verschieden** |
| `EMAIL_FROM` | **nur die Adresse**, z. B. `umweltbeirat@example.de`, ohne Anzeigenamen |
| `EMAIL_FROM_NAME` | Absendername, z. B. `Umweltbeirat Musterstadt` |
| `EMAIL_SMTP_HOST` | Server des Mailanbieters. **Ohne diesen Wert werden Mails nur ins Protokoll geschrieben.** |
| `EMAIL_SMTP_PORT`, `EMAIL_SMTP_SECURE` | empfohlen `465` mit `true` (von Anfang an verschlüsselt). Nur wenn der Anbieter kein 465 kennt: `587` mit `false` (STARTTLS). Port und Wert müssen zusammenpassen. |
| `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASSWORD` | Zugang des Postfachs. Das Passwort ohne Anführungszeichen eintragen, wenn es keine Leerzeichen enthält. |
| `REGELN_MODUS`, `RIS_MODUS` | beide auf `trocken` lassen |
| `TZ` | `Europe/Berlin` |

`EMAIL_FROM` darf eine Weiterleitungsadresse sein. Angemeldet wird mit `EMAIL_SMTP_USER`, dem eigentlichen Postfach. Manche Anbieter lehnen Absenderadressen ab, die nicht zum Konto gehören.

**Jede Variable darf nur einmal in der `.env` stehen.** Werte mit Leerzeichen (zum Beispiel Cron-Ausdrücke) in Anführungszeichen setzen: `REGELN_CRON="0 7 * * *"`.

---

## 6. Datenordner mit den richtigen Rechten anlegen

Die Anwendung läuft im Container als Benutzer mit der Kennung 1000. Der Datenordner muss ihm gehören, sonst startet sie nicht (`SQLITE_CANTOPEN`, Status `Restarting`).

```bash
mkdir -p data
sudo chown -R 1000:1000 data
```

---

## 7. Stack bauen und starten

```bash
sudo docker compose up -d --build
```

Der erste Build lädt Pakete und übersetzt die Anwendung. Das dauert einige Minuten. Danach:

```bash
sudo docker compose ps
sudo docker compose logs --tail 40 app
```

Erwartet: beide Container laufen, `app` wird nach etwa einer halben Minute `healthy`. Im Protokoll stehen `Migrated: …` (die Datenbank wird angelegt), `Vorlagen für impressum und datenschutz eingetragen` und die beiden Zeitpläne `Regellauf (trocken) geplant` und `RIS-Abgleich (trocken) geplant`.

**Lokal prüfen** (Port aus Schritt 4):

```bash
curl -s http://127.0.0.1:8056/api/users/me; echo
curl -sI http://127.0.0.1:8056/dashboard/ | head -n 1
```

Erwartet: `{"user":null,…}` und `HTTP/1.1 200 OK`.

---

## 8. nginx für die Subdomain einrichten (HTTP)

*Beirat dabei* bekommt einen **eigenen `server`-Block** mit eigenem `server_name`. Bestehende Einträge für andere Domains bleiben unverändert. nginx unterscheidet die Anfragen am Namen. Es gibt nur eine Weiterleitung für die ganze Subdomain, kein Unterpfad. Der `web`-Container des Stacks verteilt selbst auf Dashboard und Anwendung.

**8a. Wo liegen die Konfigurationen?**

```bash
ls -l /etc/nginx/sites-enabled/ /etc/nginx/conf.d/
```

Unter Debian liegen sie in `sites-available/` und sind per Verknüpfung in `sites-enabled/` aktiviert.

**8b. Neue Datei anlegen:**

```bash
sudo nano /etc/nginx/sites-available/umweltbeirat
```

```nginx
limit_req_zone $binary_remote_addr zone=bd_auth:10m rate=10r/m;

server {
    listen 80;
    server_name umweltbeirat.example.de;

    client_max_body_size 20m;

    # Anmeldung und „Passwort vergessen“ begrenzen (siehe Betrieb, Absicherung)
    location ~ ^/api/users/(login|forgot-password) {
        limit_req zone=bd_auth burst=5 nodelay;
        proxy_pass http://127.0.0.1:8056;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:8056;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

`127.0.0.1` statt `localhost` verwenden, sonst versucht nginx unter Umständen zuerst IPv6.

**8c. Aktivieren, prüfen, neu laden:**

```bash
sudo ln -s /etc/nginx/sites-available/umweltbeirat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

`reload` nur ausführen, wenn `nginx -t` mit `test is successful` endet. **Ohne `reload` arbeitet nginx mit der alten Konfiguration weiter.**

**8d. Über die Subdomain testen.** Zuerst auf dem Server, dann noch einmal vom eigenen Rechner, um eine Firewall beim Hoster auszuschließen:

```bash
curl -s  http://umweltbeirat.example.de/api/users/me; echo
curl -sI http://umweltbeirat.example.de/dashboard/ | head -n 1
```

Erwartet: `{"user":null,…}` und `HTTP/1.1 200 OK`.

---

## 9. HTTPS-Zertifikat holen

```bash
sudo certbot --nginx -d umweltbeirat.example.de
```

certbot holt das Zertifikat bei Let's Encrypt, ergänzt die Datei aus Schritt 8 selbst um einen HTTPS-Block und leitet HTTP auf HTTPS um. Fragt er nach einer Umleitung, *Redirect* wählen. Die Erneuerung richtet certbot automatisch ein.

**Prüfen:**

```bash
curl -s  https://umweltbeirat.example.de/api/users/me; echo
curl -sI http://umweltbeirat.example.de/dashboard/ | grep -iE '^(HTTP|location)'
sudo certbot renew --dry-run
```

Erwartet: Antwort über HTTPS, über HTTP ein `301` mit `Location: https://…`, beim Probelauf `all simulated renewals succeeded`.

Optional: im HTTPS-Block `add_header Strict-Transport-Security "max-age=31536000" always;`, sobald alles läuft.

---

## 10. Technisches Administratorkonto anlegen

`https://umweltbeirat.example.de/admin` aufrufen. Beim ersten Aufruf erscheint ein Formular zum Anlegen des ersten Kontos. Name, E-Mail-Adresse und ein langes Passwort eintragen. Diese erste Person wird das **technische Administratorkonto**. Es darf Mitglieder anlegen und ändern, ist aber selbst kein Mitglied und bekommt keine Mails. Das Passwort sicher aufbewahren.

**Das Formular steht jedem offen, solange es kein Konto gibt.** Lege das Konto deshalb sofort nach dem ersten Start an, bevor die Adresse bekannt wird.

---

## 11. Einstellungen eintragen

Verwaltung → **Einstellungen**:

| Feld | Eintrag |
| --- | --- |
| Name der Instanz | z. B. `Umweltbeirat Musterstadt` |
| RIS-Adapter | `komfa` |
| Adresse des RIS | z. B. `https://ris.musterstadt.example`, ohne Schrägstrich am Ende |
| Impressum, Datenschutzerklärung | enthalten Vorlagen mit Platzhaltern in `[eckigen Klammern]`. Ausfüllen kann später erfolgen, aber vor der Veröffentlichung. |

Alles andere kann zunächst bleiben. **Oben rechts auf Speichern klicken.** Ein ungespeicherter Eintrag war bei einer Installation der Grund für „0 angelegt“.

---

## 12. RIS-Kennung des Gremiums ermitteln

Der KOMFA-Adapter liest den Monatskalender des RIS und vergleicht den **Titel jeder Sitzung** mit der Kennung des Gremiums. Maßgeblich ist der Titel im **Kalender**, nicht der Name im Gremienfilter des RIS. Beide können abweichen.

Titel der letzten und nächsten Monate auflisten (Adresse, Stadt und Monate anpassen):

```bash
for m in 2026-09-01 2026-11-01 2026-12-01; do
  curl -s "https://ris.musterstadt.example/index.php?module=komfaris&action=cal&SetFilter=calstartdate&FilterValue=$m" \
    | grep -oE "Stadt Musterstadt, [^<\"]+" | sort -u
done
```

Die Kennung ist der Teil **nach** `Stadt Musterstadt, `, buchstabengetreu, z. B. `Bau- und Umweltausschuss`.

---

## 13. Gremium anlegen

Verwaltung → Inhalt → **Gremien** → Neu:

| Feld | Eintrag |
| --- | --- |
| Name | Anzeigename, z. B. `Bau- und Umweltausschuss` |
| RIS-Kennung | die Kennung aus Schritt 12 |
| Aktiv | Haken |

**Speichern** nicht vergessen.

---

## 14. RIS-Abgleich testen und scharf schalten

### 14a. Trockenlauf

In der `.env` vorübergehend ergänzen:

```dotenv
RIS_CRON="*/2 * * * *"
```

```bash
sudo docker compose up -d
```

Nach spätestens zwei Minuten:

```bash
sudo docker compose logs --since 3m app | grep -iE "trocken|abgleich|error" | head -n 30
```

Erwartet: je gefundener Sitzung eine Zeile

```
[trocken] RIS-Abgleich: neue Sitzung 2026-11-12T18:00:00.000Z (Bau- und Umweltausschuss)
```

Die Zeiten stehen in UTC. 18:00 Z im Winter bzw. 17:00 Z im Sommer entsprechen 19:00 Uhr Ortszeit.

**Achtung:** Im Modus `trocken` lautet die Zusammenfassung **immer** `0 angelegt, 0 geändert`. Ob etwas gefunden wurde, zeigen nur die `[trocken]`-Zeilen. Fehlen sie, findet der Abgleich nichts (siehe [Fehlerbehebung](#fehlerbehebung)). Der Abgleich schaut auch 45 Tage zurück (`RIS_RUECKBLICK_TAGE`), damit zur letzten Sitzung noch eine Notiz nachgetragen werden kann.

### 14b. Scharf schalten

In der `.env` `RIS_MODUS=trocken` zu `RIS_MODUS=scharf` ändern, die Zeile nicht doppelt anlegen.

```bash
sudo docker compose up -d
sudo docker compose exec app printenv RIS_MODUS RIS_CRON
```

Es muss `scharf` erscheinen. Nach zwei Läufen, also etwa vier Minuten:

```bash
sudo docker compose logs --since 5m app | grep -iE "abgleich|error" | head -n 30
```

Erwartet: erster Lauf `RIS-Abgleich: neue Sitzung …` je Sitzung und `N angelegt`, zweiter Lauf `0 angelegt, 0 geändert`. Der Abgleich legt keine Doppelten an.

### 14c. Zeitplan zurückstellen

Die Zeile `RIS_CRON=…` aus der `.env` löschen, dann:

```bash
sudo docker compose up -d
sudo docker compose exec app printenv RIS_CRON
```

Erwartet: keine Ausgabe (dann gilt der Standard `15 6,12,18 * * *`, im Protokoll bei `RIS-Abgleich (scharf) geplant` zu sehen).

### 14d. Ergebnis ansehen

*Inhalt → Sitzungen* zeigt die angelegten Sitzungen mit Beginn, Gremium und Abgesagt-Status. Das sollte zum Stand im RIS passen. Im Dashboard erscheinen sie nach der Anmeldung (Schritt 16).

---

## 15. E-Mail-Versand prüfen

Zuerst den SMTP-Zugang direkt testen, ohne die Anwendung. So grenzt man Fehler bei Zugangsdaten, Port und Absender sauber ein.

**15a. Mit curl vom Server aus.** Testnachricht anlegen (Adressen anpassen):

```bash
cat > /tmp/testmail.txt <<'EOF'
From: Umweltbeirat <umweltbeirat@example.de>
To: <empfaenger-adresse>
Subject: Beirat dabei: SMTP-Test

Testnachricht vom Server.
EOF
```

Das Passwort aus der `.env` lesen, so wird genau der Wert getestet, den die Anwendung benutzt:

```bash
SMTP_PW=$(grep '^EMAIL_SMTP_PASSWORD=' .env | cut -d= -f2-)
curl -v --ssl-reqd --url 'smtps://smtp.example.de:465' \
  --user "<smtp-benutzer>:$SMTP_PW" \
  --mail-from 'umweltbeirat@example.de' \
  --mail-rcpt '<empfaenger-adresse>' \
  --upload-file /tmp/testmail.txt 2>&1 | grep -E '^[<>] |curl:'
unset SMTP_PW
```

Erwartet am Ende `< 250 …`. Fehler beginnen mit `< 5…` und nennen den Grund, z. B. `535` (Anmeldung) oder `553` (Absender abgelehnt). Bei Port 587 mit STARTTLS: `--url 'smtp://smtp.example.de:587' --ssl-reqd`. Steht das Passwort in der `.env` in Anführungszeichen, übernimmt `cut` diese mit, und der Test scheitert, obwohl die Anwendung das Passwort korrekt liest.

**15b. Aus dem Container**, mit den Einstellungen der Anwendung und derselben Mail-Bibliothek (nodemailer):

```bash
sudo docker compose exec -T -e TO=<empfaenger-adresse> app node --input-type=module -e '
import nm from "nodemailer";
const t = nm.createTransport({
  host: process.env.EMAIL_SMTP_HOST,
  port: Number(process.env.EMAIL_SMTP_PORT),
  secure: process.env.EMAIL_SMTP_SECURE === "true",
  auth: { user: process.env.EMAIL_SMTP_USER, pass: process.env.EMAIL_SMTP_PASSWORD },
});
t.sendMail({ from: process.env.EMAIL_FROM, to: process.env.TO,
  subject: "Beirat dabei: Test aus dem Container", text: "Test" })
  .then(i => console.log("OK", i.response, "accepted:", i.accepted, "rejected:", i.rejected))
  .catch(e => console.error("FEHLER", e.code, e.response || e.message));
'
```

Erwartet `OK 250 …` und die Adresse unter `accepted`. Kommen beide Testnachrichten an, ist der SMTP-Zugang richtig. Fehlt `EMAIL_SMTP_HOST` in der `.env`, endet 15b mit `FEHLER`: Dann hat die Anwendung keinen SMTP-Server und schreibt Mails nur ins Protokoll.

---

## 16. Erstes Mitglied anlegen

Ins Dashboard kommen nur Mitglieder (Rolle *Mitglied* oder *Admin*). Das technische Administratorkonto aus Schritt 10 ist keins. Bei der Anmeldung im Dashboard erscheint dann „Dieses Konto ist kein aktives Mitglied“. Das ist richtig so.

Als technisches Konto: Verwaltung → **Mitglieder** → Neu:

| Feld | Wert |
| --- | --- |
| Name | Name des Mitglieds |
| E-Mail | persönliche Adresse, nicht die des technischen Kontos |
| Passwort | ein langes Zufallspasswort, das du nicht weitergibst |
| Rolle | *Mitglied* oder *Admin* |
| Status | Aktiv |

**Speichern.** Das Mitglied setzt sein Passwort selbst über *Passwort vergessen* im Dashboard.

**Passwort-Mail prüfen:**

1. Im privaten Browserfenster `https://umweltbeirat.example.de/dashboard/` öffnen.
2. *Passwort vergessen* für die Adresse des Mitglieds auslösen. Die Adresse von Hand eingeben.
3. Die E-Mail muss ankommen. Der Link führt ins Dashboard auf eine Seite „Neues Passwort festlegen“. Passwort setzen, anmelden, Dashboard ansehen.

**Wenn keine E-Mail kommt:** Das Dashboard antwortet auf *Passwort vergessen* immer gleich, auch bei unbekannter Adresse. So grenzt man ein:

```bash
sudo docker compose logs --since 5m app | grep -vE "\] (GET|HEAD) "
```

- Steht dort `[mail] an …` mit dem Text der Nachricht, ist `EMAIL_SMTP_HOST` nicht gesetzt (Schritt 5).
- Steht dort ein Fehler vom Versand, stimmen Zugangsdaten, Port oder Absender nicht. Dann Schritt 15 wiederholen.
- Steht dort nichts, existiert kein Konto mit genau dieser Adresse, oder es ist gesperrt.

---

## 17. Benachrichtigungsregeln testen und scharf schalten

Die Regeln laufen nach Zeitplan (`REGELN_CRON`, Standard `0 7 * * *`, also täglich um 7:00 Uhr). Die Nachricht über eine neue Teilnahme (R2) geht zusätzlich kurz nach dem Eintragen raus. Zum Testen den Zeitplan vorübergehend verkürzen. Mindestens zwei Mitgliedskonten anlegen, damit Regel 2 einen Empfänger hat. Zum Testen eignen sich Testkonten.

| Regel | Anlass | Empfänger |
| --- | --- | --- |
| R1 | Tagesordnung veröffentlicht | alle Mitglieder |
| R2 | jemand trägt sich ein | alle anderen Mitglieder, kurz danach |
| R3 | 7 Tage vorher noch niemand eingetragen | alle Mitglieder |
| R4 | letzte Person trägt sich innerhalb der 7 Tage aus | alle Mitglieder |
| R5 | 3 Tage nach der Sitzung keine Notiz | die Teilnehmenden |

Ein Austragen außerhalb der 7-Tage-Frist löst bewusst keine Nachricht aus.

### 17a. Trockenlauf

In der `.env`, jede Variable genau einmal:

```dotenv
REGELN_MODUS=trocken
REGELN_CRON="*/2 * * * *"
```

```bash
sudo docker compose up -d
sudo docker compose exec app printenv REGELN_MODUS REGELN_CRON RIS_MODUS RIS_CRON
```

Erwartet `trocken`, `*/2 * * * *`, `scharf` und bei `RIS_CRON` keine Zeile (Standard). Der Zeitplan gehört zu `REGELN_CRON`, nicht zu `RIS_CRON`.

Nach spätestens zwei Minuten:

```bash
sudo docker compose logs --since 3m app | grep -iE "regellauf|trocken|error" | head -n 30
```

Erwartet je fälliger Nachricht eine Zeile wie

```
[trocken] R1 an Max Muster (…): Umweltbeirat Musterstadt: Bau- und Umweltausschuss am Do., 12.11., Tagesordnung veröffentlicht
```

und am Ende `Regellauf (trocken): N fällig, 0 gesendet, 0 fehlgeschlagen`.

### 17b. Scharf schalten und Ablauf durchspielen

In der `.env` `REGELN_MODUS=scharf` setzen, dann:

```bash
sudo docker compose up -d
sudo docker compose exec app printenv REGELN_MODUS
```

Nach etwa vier Minuten (zwei Läufe):

```bash
sudo docker compose logs --since 5m app | grep -iE "regellauf|R[0-9]+ an|error" | head -n 30
```

Erwartet: erster Lauf `N fällig, N gesendet, 0 fehlgeschlagen`, zweiter Lauf `0 fällig`. Niemand bekommt dieselbe Nachricht zweimal.

Dann den Ablauf einmal von Hand prüfen:

1. Die R1-Mail kommt an, mit dem Namen der Instanz als Absender und Link zur Tagesordnung.
2. In der Mail auf **Ich nehme teil** klicken: Bestätigungsseite, im Dashboard ist die Teilnahme eingetragen.
3. Das andere Mitglied bekommt kurz danach eine Mail „… neue Teilnahme“ (R2).
4. Im Dashboard wieder austragen. Austragen löscht die Teilnahme nicht, sondern setzt das Ende der Teilnahme. Eine Nachricht entsteht nur nach R4, also wenn sich die letzte Person innerhalb der 7 Tage vor der Sitzung austrägt.
5. Wieder eintragen. Im Protokoll erscheint nach etwa zehn Sekunden ein Lauf außerhalb des Zeitplans, mit R2 an die anderen Mitglieder.

### 17c. Zeitplan zurückstellen

Die Zeile `REGELN_CRON=…` aus der `.env` löschen, dann:

```bash
sudo docker compose up -d
sudo docker compose exec app printenv REGELN_CRON
```

Erwartet: keine Ausgabe (Standard `0 7 * * *`).

### 17d. Echte Mitglieder aufnehmen

Der Regellauf arbeitet nach dem aktuellen Zustand: Eine Nachricht ist fällig, wenn eine Regel zutrifft und im Versandprotokoll für **diese Person** zu **dieser Sitzung** noch kein Eintrag steht. Später angelegte Mitglieder bekommen deshalb beim nächsten Lauf die offenen Hinweise nachträglich, z. B. „Tagesordnung veröffentlicht“ zu allem, was schon im System steht. **Lösche deshalb keine Sitzungen.**

Reihenfolge:

1. **Erst auf `trocken` stellen**, damit beim Anlegen niemand vorzeitig E-Mails bekommt (`REGELN_MODUS=trocken`, `REGELN_CRON="*/2 * * * *"`, `sudo docker compose up -d`, mit `printenv` prüfen).
2. **Testkonten sperren:** Status *Gesperrt*, speichern. Gesperrte Konten bekommen keine Nachrichten.
3. **Impressum und Datenschutz** in den Einstellungen ausfüllen, die Vorlagen enthalten Platzhalter.
4. **Mitglieder anlegen** (Schritt 16).
5. **Protokoll prüfen**, nach spätestens zwei Minuten: `[trocken] R1 an <neues Mitglied> …` je neuem Mitglied und offener Tagesordnung, gegebenenfalls `R2` zu bereits besetzten Sitzungen. Wer die Nachricht schon bekommen hat, erscheint nicht erneut.
6. **Scharf schalten:** `REGELN_MODUS=scharf`, Zeile `REGELN_CRON` löschen, `sudo docker compose up -d`. Die Nachrichten gehen beim nächsten Lauf um 7:00 Uhr raus.
7. **Den neuen Mitgliedern vorher die Kurzanleitung schicken.** Ihr Passwort setzen sie selbst über *Passwort vergessen*.

---

## 18. Backups

Das Skript `scripts/backup.sh` sichert die Datenbank und die Uploads. Für eine konsistente Sicherung im laufenden Betrieb braucht der Server `sqlite3`:

```bash
sudo apt install sqlite3
```

Ohne `sqlite3` stoppt das Skript die Anwendung kurz. Erster Lauf von Hand:

```bash
scripts/backup.sh
ls -l backups/
```

Wenn `data/` dem Benutzer 1000 gehört und du ein anderer Benutzer bist, das Skript mit `sudo` ausführen. Dann regelmäßig (`sudo crontab -e`, täglich 3:15 Uhr):

```
15 3 * * * cd /home/<benutzer>/beirat-dabei && scripts/backup.sh >> backups/backup.log 2>&1
```

**Wiederherstellung einmal zur Probe ausführen**, am besten auf einem zweiten Rechner: `scripts/restore.sh backups/<Archiv>`, dann `sudo docker compose up -d`. Die `.env` ist nicht im Archiv. Bewahre sie getrennt auf. Kopien der Archive außer Haus **verschlüsseln** (siehe Betrieb, Absicherung).

---

## Fehlerbehebung

| Symptom | Ursache | Lösung |
| --- | --- | --- |
| `permission denied while trying to connect to the Docker daemon socket` | Benutzer darf Docker nicht direkt ansprechen | Befehl mit `sudo` ausführen |
| `app` im Status `Restarting`, im Log `SQLITE_CANTOPEN` | Datenordner gehört `root` | `sudo docker compose stop app`, `sudo chown -R 1000:1000 data`, `sudo docker compose up -d` (Schritt 6) |
| `app` startet nicht, Log nennt `MAGIC_LINK_SECRET und PUBLIC_URL müssen gesetzt sein` | Wert fehlt in der `.env` | Schritt 5 |
| `port is already allocated` beim Start | Port von einem anderen Dienst belegt | freien Port wählen (Schritt 4), in `.env` als `PORT` eintragen, `sudo docker compose up -d` |
| `/dashboard/` antwortet lokal, `/api/users/me` bleibt leer | Anwendung läuft nicht, nur der `web`-Container | `sudo docker compose ps` und `logs app` prüfen (Schritt 7) |
| Build bricht ab, Meldung zu Speicher (`killed`, `ENOMEM`) | zu wenig Arbeitsspeicher beim Bauen | Swap einrichten oder 2 GB RAM bereitstellen, `sudo docker compose up -d --build` wiederholen |
| Über die Subdomain kommt `404 Not Found` von nginx | nginx kennt den neuen `server`-Block noch nicht | `sudo nginx -T 2>/dev/null \| grep -nE 'server_name\|# configuration file'` zeigt, ob die Datei geladen wird. Danach `sudo nginx -t` und `sudo systemctl reload nginx`. |
| `502 Bad Gateway` von nginx | `proxy_pass` zeigt auf einen falschen Port, oder der Stack läuft nicht | Port in nginx und `.env` vergleichen, `sudo docker compose ps` |
| Browser landet auf einer anderen Adresse | Weiterleitung beim Domain-Anbieter | Weiterleitung entfernen, `A`-Eintrag setzen (Schritt 2). Zum Testen privates Browserfenster, da Browser `301`-Weiterleitungen zwischenspeichern. |
| Anmeldung klappt, danach wieder Login | `COOKIE_SECURE=true`, aber Aufruf über HTTP | Immer über HTTPS aufrufen (Schritt 9) |
| Eintrag in Einstellungen oder Gremien ist nach dem Neuladen weg | nicht gespeichert | oben rechts **Speichern** klicken, bevor man die Seite verlässt |
| RIS-Abgleich im Log immer `0 angelegt, 0 geändert` im Modus `trocken` | im Trockenlauf normal | auf Zeilen `[trocken] RIS-Abgleich: neue Sitzung …` achten (Schritt 14a) |
| Keine `[trocken]`-Zeilen, kein Fehler | kein aktives Gremium, leere oder falsche RIS-Kennung, Adapter oder Adresse fehlen | Gremium und Einstellungen prüfen (Schritte 11 bis 13). Steht im Log `übersprungen (Adapter "manuell" …)`, fehlt der RIS-Adapter. |
| Geänderter Wert in der `.env` wirkt nicht | `restart` statt `up -d`, oder Variable doppelt | `grep -n "^RIS_\|^REGELN_" .env`, Doppelte löschen, `sudo docker compose up -d`, mit `printenv` prüfen |
| Dashboard: „Dieses Konto ist kein aktives Mitglied“ | Konto mit Rolle *Technisches Administratorkonto* oder gesperrt | Mitglied anlegen (Schritt 16) |
| Mitglieder können sich nicht anmelden, „zu viele Fehlversuche“ | Konto nach fünf falschen Passwörtern zehn Minuten gesperrt | warten oder über *Passwort vergessen* ein neues setzen |
| *Passwort vergessen*: keine E-Mail, im Log `[mail] an …` | `EMAIL_SMTP_HOST` nicht gesetzt | Schritt 5, dann `sudo docker compose up -d` |
| *Passwort vergessen*: keine E-Mail, kein Fehler im Log, SMTP-Test klappt | kein Konto mit genau dieser Adresse, oder das Konto ist gesperrt | Adresse zeichengenau eingeben, Konten in der Verwaltung prüfen |
| SMTP-Test mit curl klappt, aber die Anwendung versendet nicht | `EMAIL_FROM` enthält einen Anzeigenamen, oder Port und Verschlüsselung passen nicht (`465` mit `true`, `587` mit `false`) | Werte in der `.env` korrigieren (Schritt 5), `up -d` |
| Regellauf meldet nichts, `printenv REGELN_CRON` zeigt nichts oder `0 7 * * *` | Zeitplan bei `RIS_CRON` statt `REGELN_CRON` eingetragen | `.env` prüfen (Schritt 17a) |
| Keine Nachricht, wenn sich jemand austrägt | gewollt: nur die letzte Person innerhalb der 7 Tage löst R4 aus | – |
| Neue Mitglieder sollen Hinweise zu bestehenden Sitzungen bekommen | – | geschieht automatisch beim nächsten Regellauf, Sitzungen nicht löschen (Schritt 17d) |
