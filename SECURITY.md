# Sicherheit

## Schwachstellen melden

Bitte **nicht** als öffentliches Issue. Nutze auf GitHub „Security → Report a vulnerability“ (privates Advisory) oder schreibe an die Betreuenden des Repositorys. Nenne Version, betroffene Stelle und wenn möglich einen Weg, es nachzustellen. Eine erste Antwort gibt es in der Regel innerhalb von sieben Tagen.

## Annahmen

- Eine Instanz gehört einer kleinen, vertrauenswürdigen Gruppe (ein Beirat). Mitglieder sind keine Fremden, aber auch sie sollen nur das tun können, was ihre Rolle erlaubt.
- Das System hängt am Internet hinter einem Reverse Proxy mit HTTPS. Der Stack lauscht nur auf `127.0.0.1`.
- Alle Rechte stehen als Code im Repository (`app/src/access.ts`, `app/src/collections/`). Mitglieder haben keinen direkten Datenzugriff, nur die Endpoints, die Rolle, Fristen und Besitz selbst prüfen.

## Eigenschaften, die man kennen sollte

- **Das erste Konto ist das technische Administratorkonto.** Bis es existiert, kann jede Person, die die Adresse erreicht, es anlegen. Lege es deshalb direkt nach dem ersten Start an, bevor die Adresse bekannt wird (Installation, Schritt 10).
- **Nur das technische Konto ändert Benutzer.** Mit einem Schreibrecht auf Benutzer könnte sich jede Rolle zum Administrator machen. Die Rolle *Admin* sieht Benutzer, ändert sie aber nicht. Das Feld `rolle` ist zusätzlich auf das technische Konto beschränkt.
- **Gesperrte Konten** können sich nicht anmelden, und die Endpoints weisen sie ab, auch mit einem noch gültigen Sitzungs-Cookie.
- **Anmeldeversuche** sind pro Konto begrenzt (fünf Fehlversuche, zehn Minuten Sperre). „Passwort vergessen“ ist es nicht, und die Antwort verrät nicht, ob eine Adresse existiert. Begrenze beides zusätzlich am Reverse Proxy (siehe `docs/Betrieb.md`, Abschnitt „Absicherung“).
- **Links in Mails und das Kalender-Abo sind Zugangsdaten.** Sie sind mit `MAGIC_LINK_SECRET` signiert, laufen ab (Kalender-Abo: nicht, bis die Version der Kalender-Abos erhöht wird) und gelten nur für die jeweilige Aktion und Person.
- **Backups** enthalten personenbezogene Daten und gehören verschlüsselt, wenn sie den Server verlassen.
- **Der automatische Abruf beim RIS** nutzt einen erkennbaren User-Agent und pausiert zwischen den Abrufen. Kläre vorher, ob der Betreiber des RIS das zulässt.

## Vor dem Einsatz

Die Vorlagen für Impressum und Datenschutzerklärung (`docs/vorlagen/`) sind ein Ausgangspunkt, keine Rechtsberatung. Lass sie für deine Instanz prüfen. Die Vorlagen und Beispieldaten dieses Repositorys enthalten erfundene Angaben.
