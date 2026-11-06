# Beirat dabei – Konzept

Stand: 03.11.2026 · Entwurf

**Beirat dabei** ist eine allgemeine Sitzungsbegleitung für Beiräte und Initiativen, die Ausschüsse ihrer Kommune verfolgen. Repo und Container heißen `beirat-dabei`.

## Ausgangslage und Ziel

Ziel: Der Informationsfluss zwischen den Ausschüssen der Kommune (Ratsinformationssystem - RIS) und den Beiräten soll verbessert und transparenter gestaltet werden und die Prozesse innerhalb der Beiräte unterstützt werden.

Bei jeder Sitzung der begleiteten Ausschüsse sitzt ein Mitglied des Beirats im Publikum, und was dort für den Beirat relevant war, ist danach festgehalten.

Die Abstimmung im Beirat erfordert heute, dass jemand Termine und Tagesordnungen im Blick behält, Freiwillige anspricht und Rückmeldungen einsammelt. Das System nimmt diese Arbeit ab. Es zeigt alle Termine an einem Ort und meldet sich nur, wenn etwas zu tun ist.

Das System wird in zwei Ausbaustufen umgesetzt:

1. **Ausbaustufe 1:** Dashboard, Teilnahme, Kurznotiz und Benachrichtigungen nach festen Regeln.
2. **Ausbaustufe 2 (optional, später):** KI-Unterstützung beim Lesen der Tagesordnungen, beim Erkennen von Fristen und beim Erfassen von Notizen.

Die Entwürfe der Oberflächen liegen im [Design-Canvas](https://claude.ai/artifact/LC4Hc6zD3mKhUgsWYcmDhb).

## Allgemeiner Kern, Einstellungen pro Instanz

Der Kern ist für jeden Beirat nutzbar. Ortsspezifisch sind nur die Anbindung an das Ratsinformationssystem und die Konfiguration.

| Allgemein (Kern) | Pro Instanz einstellbar | Beispiel |
| --- | --- | --- |
| Dashboard, Teilnahme, Magic Links, iCal | Name, Logo, Domain, Absender | Beirat dabei · Beirat Musterstadt |
| Regel-Engine für Benachrichtigungen | Fristen vor und nach der Sitzung | 7 Tage vorher, 3 Tage danach |
| Kurznotiz | Fragen im Notizformular | drei Fragen, siehe Ausbaustufe 1 |
| Datenmodell mit Gremien | begleitete Gremien | ein Ausschuss, z. B. Bauausschuss |
| Rollenmodell Mitglied/Admin/technisches Konto | – | Mitglied, Admin, technisches Konto |
| Schnittstelle für RIS-Adapter | Adapter und Quelle | KOMFA-Adapter (Kalender, iCal, Tagesordnungsseite) |
| KI-Vorsortierung (Stufe 2) | Themenfokus | die Themen des Beirats |

**Eine Instanz pro Beirat.** Jeder Beirat betreibt seinen eigenen Stack. Eine Plattform für viele Beiräte ist nicht vorgesehen. Das hält Rechte, Daten und Übergabe einfach.

**Die erste Instanz ist der Maßstab.** Allgemein wird nur, was wenig kostet: Werte in die Konfiguration, RIS-Zugriff hinter eine Schnittstelle. Gebaut wird zunächst nur der Adapter, den die erste Instanz braucht (KOMFA RIS).

## Ausbaustufe 1: Funktionen

Das Dashboard im Browser ist die zentrale Ansicht. Ergänzt wird es durch E-Mails mit Magic Links und optional ein Kalender-Abo.

**Dashboard, pro Sitzung**

| Feld | Inhalt |
| --- | --- |
| Termin | Datum, Uhrzeit, Ort, Countdown, bei mehreren Gremien auch das Gremium |
| Tagesordnung | „noch nicht veröffentlicht“ oder Link zur TO im Ratsinformationssystem |
| Teilnahme | Namen der Eingetragenen oder „noch niemand“, dazu der Knopf „Ich nehme teil“ |
| Ergebnis (nach der Sitzung) | Relevant für den Beirat: ja/nein, dazu die Kurznotiz |

**Status je Sitzung**

| Status | Bedeutung |
| --- | --- |
| Besetzt | mindestens eine Person eingetragen |
| Noch offen | niemand eingetragen, mehr als 7 Tage bis zur Sitzung |
| Dringend | niemand eingetragen, 7 Tage oder weniger |
| Notiz fehlt | Sitzung vorbei, keine Notiz, mindestens eine aktive Teilnahme |
| Nicht besetzt | Sitzung vorbei, niemand eingetragen |
| Dokumentiert | Sitzung vorbei, Notiz vorhanden |

Oben stehen die anstehenden Sitzungen, darunter die vergangenen mit ihren Notizen. Begleitet eine Instanz mehrere Gremien, kommt ein Filter nach Gremium dazu.

**Kurznotiz:** eine gemeinsame Notiz pro Sitzung, die alle Teilnehmenden ergänzen können. Die Fragen sind je Instanz einstellbar. Ein Beispiel mit drei Fragen, nur die erste ist Pflicht:

1. War etwas Relevantes für den Beirat dabei? (ja/nein)
2. Welche TOPs betrafen die Themen des Beirats?
3. Was wurde beschlossen oder vertagt, und muss der Beirat etwas tun?

**Magic Links:** Jeder Link gilt für eine Person und eine Sitzung. Der Link öffnet eine Bestätigungsseite, erst der Knopf dort (POST) trägt ein. So lösen Mail-Scanner und Link-Vorschauen nichts aus. Danach gibt es „Rückgängig machen“. Der Token ist signiert. Links in Mails gelten bis zum Sitzungsende plus 14 Tage (einstellbar), der „Rückgängig“-Link nach dem Klick 30 Minuten. Eine Anmeldung ist nicht nötig.

**Kalender (optional):** eine persönliche iCal-Abo-Adresse mit allen Sitzungsterminen, die Mitglieder im Dashboard abrufen und in ihren eigenen Kalender übernehmen können. Der Token ist pro Mitglied abgeleitet, gesperrte Mitglieder verlieren den Zugang sofort, und über `abo_version` in den Einstellungen lassen sich alle Adressen widerrufen.

## Benachrichtigungsregeln

Fünf feste Regeln, geprüft von einem täglichen Lauf am Morgen (7:00 Uhr). Zusätzlich läuft die Prüfung sofort, wenn sich jemand ein- oder austrägt. Regel 2 geht deshalb ohne Verzögerung raus. Die Fristen sind je Instanz einstellbar, die Werte unten sind die Voreinstellung. Ein Versandprotokoll stellt sicher, dass niemand dieselbe Nachricht zweimal erhält.

| # | Auslöser | Bedingung | Empfänger | Kanal und Inhalt |
| --- | --- | --- | --- | --- |
| 1 | Tagesordnung veröffentlicht | – | alle Mitglieder | E-Mail mit Link zur TO und Magic Link „Ich nehme teil“ |
| 2 | Jemand trägt sich ein | – | alle anderen Mitglieder | E-Mail: „X nimmt am … teil“ |
| 3 | 7 Tage vor der Sitzung | niemand eingetragen | alle Mitglieder | E-Mail mit Magic Link „Ich nehme teil“ |
| 4 | Letzte Person trägt sich aus | innerhalb der 7 Tage | alle Mitglieder | wie Regel 3 |
| 5 | 3 Tage nach der Sitzung | keine Notiz vorhanden | die Teilnehmenden | E-Mail mit Link zur Kurznotiz |

**Grenzfälle**

- **Tagesordnung kommt spät:** Erscheint sie erst innerhalb der letzten 7 Tage und ist noch niemand eingetragen, gehen Regel 1 und 3 als eine gemeinsame E-Mail raus.
- **Verschiebung:** Die Fristen werden neu berechnet. Eingetragene behalten ihren Eintrag und werden informiert.
- **Absage:** Eine Info geht an die Eingetragenen, danach keine weiteren Nachrichten.
- **Doch nicht teilgenommen:** Die Erinnerungsmail enthält einen Link, mit dem man das meldet. Danach kommt keine weitere Erinnerung.
- **Austragen außerhalb der 7-Tage-Frist** löst keine Nachricht aus (bewusst so entschieden).
- **Später aufgenommene Mitglieder** bekommen offene Hinweise zu bestehenden Sitzungen beim nächsten Lauf nachträglich. Das Versandprotokoll gilt pro Person.
- **Kanal:** Alle Regeln laufen in Stufe 1 per E-Mail. Push (etwa über eine vorhandene Bürger-App der Kommune) ist ein möglicher späterer Zusatzkanal für Regel 2.

## Technische Umsetzung

Entscheidung: ein eigener Webservice auf Basis von Payload CMS, als eigener Docker-Stack. Er kann neben anderen Diensten auf einem vorhandenen Server laufen und lässt sich auf jeden anderen Server umziehen.

**Geprüfte Optionen**

| Option | Bewertung |
| --- | --- |
| Vorhandene Bürger-App | Backend, Login und Nutzergruppen oft schon vorhanden. Eine solche App ist aber öffentlich, jedes Mitglied müsste die App installieren, und Änderungen laufen durch den Store-Review. Geeignet für den öffentlichen Teil (Sitzungstermine), nicht für den internen Ablauf. |
| KI-Agent als Kern | Fristen müssen jedes Mal zuverlässig greifen. Ein Sprachmodell ist dafür nicht deterministisch genug. Sinnvoll als Zusatz, siehe Ausbaustufe 2. |
| **Eigener Webservice (gewählt)** | Deckt Dashboard, Magic Links und iCal ohne Installation ab. Payload CMS liefert Datenmodell, Rollen, Zugriffsregeln, Anmeldung und Admin-Oberfläche. |
| Low-Code (n8n, Nextcloud) | Schnell als Pilot, aber Logik über mehrere Werkzeuge verteilt, Dashboard nur mühsam. |
| Bordmittel des RIS | Eventuell Benachrichtigung bei neuen Dokumenten. Deckt nur Regel 1 ab, wird aber als Datenquelle geprüft. |

**Eigene Instanz statt Mitnutzung einer vorhandenen App.** Das Beiratssystem bekommt eine eigene Instanz und eine eigene Datenbank. So bekommen Nachfolger Adminrechte ohne Zugriff auf fremde Daten, der Umzug ist ein Umzug von Container und Datenbank, und Störungen bleiben getrennt.

```
                     ┌─ Docker-Stack beirat-dabei ─────────────────┐
RIS der Stadt ─────▶ │  RIS-Adapter (OParl, iCal/RSS, Scraper, …)  │
                     │            │                                │
                     │            ▼                                │
                     │  Payload + SQLite (Daten, Rollen, API) ─────┼──▶ Dashboard (Browser)
                     │       │                     │               │
                     │       ▼                     ▼               │
Kalender-Abo ◀───────┼─ Endpoints             Zeitpläne ──────────┼──▶ E-Mail / Push
                     │  Links, iCal, Dashboard  Regeln, RIS-Abgleich│         │
                     └───────▲─────────────────────────────────────┘         │
                             └──────────── Klick auf Magic Link ─────────────┘
```

Der RIS-Adapter füllt die Datenbank. Von dort lesen das Dashboard, die Regeln und die Endpoints. Ein Klick auf einen Link in der E-Mail landet bei einem Endpoint und trägt ein.

**Bausteine im Docker-Stack**

| Baustein | Aufgabe |
| --- | --- |
| Payload CMS (MIT) | Datenmodell, Rollen, Zugriffsregeln, Admin-Oberfläche, Anmeldung |
| SQLite | Daten als eine Datei im Volume, kein eigener Container |
| Endpoints (`app/`) | Dashboard-API, Links aus Mails (signierter Token), iCal-Feed, öffentliche Seiten |
| `packages/handlers` | Logik der Endpoints, Mailtexte, Regellauf und Abgleich. Kennt Payload nicht und ist per Unit-Test abgedeckt. |
| Zeitpläne (`app/src/laeufe.ts`) | die fünf Benachrichtigungsregeln täglich und nach Änderungen an Teilnahmen, der RIS-Abgleich dreimal täglich |
| `packages/core` | Fristen, Regeln, Token, iCal als reine Funktionen |
| RIS-Adapter | holt Termine und Tagesordnungen über einen austauschbaren Adapter; eigenes Paket `packages/ris-adapter` |
| Dashboard-Frontend | schlanke statische Seite gegen die API |

**SQLite statt Postgres.** Bei rund zehn Mitgliedern und einigen Dutzend Sitzungen pro Jahr reicht SQLite. Die ganze Datenbank ist eine Datei, das vereinfacht Backup, Umzug und Übergabe. Einschränkung: nur eine Instanz der Anwendung gleichzeitig. Payload unterstützt auch Postgres. Ein späterer Wechsel zu Postgres wäre eine Migration, ist aber nicht absehbar nötig.

**Datenmodell**

| Sammlung | Wichtige Felder |
| --- | --- |
| einstellungen | Global: Name, Logo, Fristen, Notizfragen, Themenfokus, RIS-Adapter und Adresse, Version der Kalender-Abos, Impressum, Datenschutz |
| gremien | Name, Kennung im RIS, aktiv |
| sitzungen | Gremium, Beginn, Ort, Link ins RIS, TO-Status, abgesagt |
| teilnahmen | Sitzung, Mitglied (`users`), eingetragen am, ausgetragen am, nicht teilgenommen |
| notizen | Sitzung, relevant ja/nein, Antworten auf die Notizfragen |
| dokumente | Titel, Kategorie, Datum, Datei, veröffentlicht |
| benachrichtigungen | Regel, Sitzung, Empfänger (Versandprotokoll) |
| medien | Logo und Bilder |

**Anmeldung und Mitglieder.** Mitglieder sind Benutzer (`users`) mit einer Rolle, die Anmeldung läuft über Payload mit Sitzungs-Cookie. Eine eigene Sammlung `mitglieder` gibt es nicht, `teilnahmen` verweisen auf `users`. Sperren geht über ein Statusfeld, nach fünf falschen Passwörtern ist ein Konto zehn Minuten gesperrt. Als Kanal ist in Stufe 1 nur E-Mail vorgesehen.

**Zugriffsregeln als Code.** Rollen und Rechte stehen in `app/src/access.ts` und in den Sammlungen, nicht in einer Datenbank-Konfiguration: Sie sind versioniert, reviewbar und testbar.

- Mitglieder greifen nie direkt auf Daten zu. Alles läuft über die Endpoints, die Rolle, Fristen und Besitz im Code prüfen. Mitglieder sehen die Namen der anderen, nie deren E-Mail-Adressen.
- Die Verwaltungsoberfläche ist für *Admin* und das technische Konto offen. Admins pflegen Gremien, Sitzungen, Dokumente und Einstellungen.
- Nur das technische Administratorkonto legt Benutzer an, ändert und löscht sie. Sonst könnte sich jede Person mit diesem Recht zum Administrator machen (siehe `SECURITY.md`).
- Der erste registrierte Benutzer wird das technische Konto. Es ist selbst kein Mitglied.

**Warum Payload statt Directus.** Directus 12 steht unter einer „source-available“-Lizenz (MSCL) mit Grenzen in der kostenlosen Stufe: höchstens drei Zugänge zur Verwaltung, 25 Sammlungen, keine Feld- und Filterregeln für Rechte, anonyme Nutzungsdaten in der Voreinstellung. Beim Test zeigte sich, dass sich ohne Feldregeln eine Person mit Schreibrecht auf Benutzer zum Administrator machen konnte. Payload ist MIT-lizenziert, hat keine solchen Grenzen, ist in TypeScript geschrieben (der Kern läuft unverändert im selben Prozess) und erlaubt Zugriffsregeln als Code. Der Preis ist ein größerer Betriebsaufwand (Node, rund 250 MB Arbeitsspeicher statt eines schlanken Dienstes) und ein Admin-Panel, das nicht selbst gestaltet wird. PocketBase (MIT, ein Go-Programm) wäre leichter, hätte aber das Neuschreiben der Logik in Go oder einen zweiten Dienst bedeutet.

**Rollen**

| Rolle | Für wen | Rechte |
| --- | --- | --- |
| Mitglied | einfache Mitglieder | Dashboard sehen, sich ein- und austragen, Notizen schreiben (alles über die Endpoints) |
| Admin | Administrierende | zusätzlich Gremien, Sitzungen, Dokumente und Einstellungen verwalten, Mitglieder ansehen |
| Technisches Administratorkonto | eine Person, die den Server betreut | zusätzlich Mitglieder anlegen, ändern, sperren, löschen. Ist kein Mitglied und bekommt keine Mails. |

**RIS-Adapter.** Der Kern spricht nur mit einer kleinen Schnittstelle: Sitzungen eines Gremiums abrufen und die Tagesordnung einer Sitzung abrufen. Der Abgleich läuft alle paar Stunden und erkennt neue Sitzungen, Verschiebungen, Absagen und das Erscheinen einer Tagesordnung. Vorgesehene Adapter:

1. **OParl**, der offene Standard für Ratsinformationssysteme
2. **iCal oder RSS**, falls das RIS nur Feeds liefert
3. **Scraper** für verbreitete RIS-Produkte wie SessionNet, ALLRIS oder KOMFA RIS
4. **Manuell**, damit das System auch ohne Schnittstelle nutzbar ist

Weitere Adapter können andere Instanzen beitragen.

**Beispiel KOMFA RIS.** Beim [KOMFA RIS](https://www.komfa.de) sind ein OParl-Zugang und ein RSS-Feed nicht erkennbar. Es gibt aber pro Sitzung eine iCal-Datei und eine Tagesordnungsseite mit nummerierten TOPs, Ort, Uhrzeit, Einladung als PDF und Vorlagen. Der KOMFA-Adapter kombiniert deshalb iCal und Scraping:

1. Monatskalender der nächsten ein bis drei Monate abrufen (`action=cal`) und die Sitzungen des begleiteten Gremiums (RIS-Kennung) mit ihrer ID herausfiltern.
2. Beginn, Ende und Ort aus der iCal-Datei der Sitzung lesen (`action=ic`).
3. Tagesordnungsseite abrufen (`action=to`). Sind TOPs vorhanden oder steht die Einladung zum Download (`action=dlg`), gilt die TO als veröffentlicht und Regel 1 greift. „Die Tagesordnung ist nicht verfügbar“ heißt: noch nicht veröffentlicht.
4. Absagen und Verschiebungen durch Vergleich mit dem letzten Abgleich erkennen. Dieselbe Sitzungs-ID mit anderem Beginn ist eine Verschiebung. Fehlt eine kommende Sitzung bei vollständigem Abruf, gilt sie als abgesagt.

Der Adapter fragt nur wenige Male am Tag ab, pausiert zwischen den Abrufen, nutzt einen Cache und sendet einen erkennbaren User-Agent. Getestet wird er gegen erfundene Beispielantworten im Aufbau des RIS unter `packages/ris-adapter/test/fixtures/komfa/`.

**Regeln als Code statt Konfiguration.** Die Benachrichtigungsregeln laufen als Zeitplan der Anwendung (`croner`), nicht als Abläufe in einer Oberfläche. Code ist versioniert, reviewbar und per Unit-Test abgedeckt.

**Testbarkeit.** Fristen, Regeln, Magic-Link-Token und iCal sind reine Funktionen in `packages/core`: Eingabe ist der Zustand, Ausgabe sind die fälligen Nachrichten. Unit-Tests decken sie vollständig ab, auch die Grenzfälle aus dem Regelabschnitt. Die Adapter werden gegen gespeicherte RIS-Antworten getestet und sind so unabhängig vom echten RIS.

**Bürger-App als Zusatzkanal.** Später können die öffentlichen Sitzungstermine mit Link zur TO in einer Bürger-App der Kommune erscheinen. Personalisierter Push für eine Gruppe „Beirat“ wäre ein weiterer Kanal für Regel 2. Interne Daten bleiben im Beiratssystem.

## Betrieb und Übergabe

Das System muss ohne seinen Erbauer weiterlaufen: In diesem Fall übernehmen andere Beiratsmitglieder den Betrieb.

- **Konfiguration als Code.** Datenmodell, Rollen und Zugriffsregeln liegen im Git-Repo, die Datenbank wird beim Start per Migration aufgebaut.
- **Ein Stack, eine Datei.** `docker-compose.yml` plus `.env`. Der Umzug auf einen anderen Server ist Repo und Datenbankdatei kopieren, dann starten.
- **Funktionsadressen statt persönlicher Konten.** Ein SMTP-Konto, das dem Beirat gehört (etwa beirat@…) und eine Domain beirat.[ort].de. Bei einem Domainwechsel ändern sich alle Links in alten E-Mails. Der Absender darf eine Weiterleitungsadresse sein, angemeldet wird mit dem eigentlichen Postfach (`EMAIL_SMTP_USER`). Für die Übergabe sollte es ein Postfach des Beirats sein, kein persönliches.
- **Admins über eine Rolle.** Administrieren kann, wer die Rolle *Admin* hat. Mitglieder anlegt das technische Konto, dessen Zugang zur Übergabe gehört.
- **Backup und Restore als Skript.** Gesichert werden die SQLite-Datei und die Uploads. Die Datei wird mit `sqlite3 .backup` gesichert oder bei kurz gestopptem Container kopiert, nie einfach im laufenden Betrieb. Die Wiederherstellung verschiebt die bisherigen Daten beiseite statt sie zu löschen und wird einmal getestet.
- **Betriebsanleitung** für Nicht-Entwickler unter [`Betrieb.md`](Betrieb.md): starten, aktualisieren, Mitglied anlegen, Sitzungen pflegen, RIS-Modus umstellen, Backup einspielen, häufige Probleme.

**Repo-Aufteilung.** Der allgemeine Kern liegt öffentlich in `beirat-dabei`, mit einer `.env.example` ohne Geheimnisse. Die `.env` einer Instanz mit SMTP-Zugang und Schlüsseln liegt nur auf dem Server.

**Neue Instanz.** Name, Logo, Fristen, Notizfragen, RIS-Adapter, Gremien und Texte stehen in der Verwaltung der Instanz. Ein Import aus einer Datei (`instanz.yaml`) wie in der Directus-Fassung gibt es noch nicht. Die Verzeichnisstruktur steht in der README.

**Datenschutz.** Gespeichert werden Name, E-Mail-Adresse, Teilnahmen und Notizen. Zugriff haben nur Beiratsmitglieder mit der Rolle *Mitglied* oder *Admin*.

## Ausbaustufe 2: KI-Unterstützung (optional, später)

Die KI übernimmt das Lesen und Formulieren, die festen Regeln aus Stufe 1 bleiben unverändert. Der Themenfokus der Vorsortierung ist je Instanz einstellbar, zum Beispiel Umwelt, Natur und Klima. Stufe 2 beginnt erst, wenn Stufe 1 stabil läuft.

| Funktion | Was passiert | Nutzen |
| --- | --- | --- |
| Tagesordnung vorsortieren | Sobald die TO erscheint, liest ein Agent sie samt Beschlussvorlagen und markiert möglicherweise relevante TOPs mit je einem Satz Begründung. Die Treffer erscheinen im Dashboard und in der TO-Mail. | Man sieht sofort, worum es geht. Das motiviert zum Eintragen. |
| Fristen erkennen | Der Agent findet Beteiligungsfristen in Vorlagen, etwa zur öffentlichen Auslegung eines B-Plans. Ein Mitglied bestätigt oder verwirft. Bestätigte Fristen kommen in Dashboard, iCal und eine Erinnerung vor Ablauf. | Fristen für Stellungnahmen gehen nicht mehr unter. |
| Notiz per Sprachnachricht | Nach der Sitzung zwei Minuten ins Handy sprechen. Transkription und Agent füllen die drei Notizfelder vor. Die Person prüft und übernimmt. Die Aufnahme wird danach gelöscht. | Die Hürde für die Notiz sinkt, Erinnerungen werden seltener nötig. |

**Leitplanken**

- Die KI ergänzt nur Daten. Sie verschickt keine Nachrichten und löst keine Regeln aus.
- Alle KI-Inhalte sind als „KI-Einschätzung“ oder „KI-Entwurf“ gekennzeichnet. Fristen und Notizen gelten erst nach Bestätigung durch ein Mitglied.
- Modellwahl nach Datenart: Tagesordnungen und Vorlagen sind öffentlich. Für Notizen und Sprachaufnahmen nur ein EU-gehostetes oder lokal betriebenes Modell.
- Prompts liegen im Repo, das Modell ist per `.env` austauschbar, die KI-Funktionen sind abschaltbar. Ohne KI läuft das System wie in Stufe 1.

**Einbindung.** Bei „TO veröffentlicht“ oder „Sprachnachricht eingegangen“ ruft ein Zeitplan einen kleinen Agent-Worker im selben Stack auf. Der schreibt seine Ergebnisse in eigene Felder zurück, etwa `relevante_tops` oder `fristen`.

**Spätere Ideen:** Abgleich der Notiz mit der offiziellen Niederschrift, Suche über das Archiv aller Notizen, Entwürfe für Stellungnahmen und den Jahresbericht.

## Offene Fragen und nächste Schritte

**Offene Fragen**

- Eigenes Postfach für den Beirat als SMTP-Konto (Absender bisher eine Weiterleitungsadresse).
- Ob der Betreiber des RIS den automatischen Abruf ausdrücklich zulässt.

**Nächste Schritte**

- [x] RIS prüfen und passenden Adapter wählen (KOMFA RIS, Adapter umgesetzt)
- [x] Datenmodell, Rollen und Zugriffsregeln, Dashboard-API, Links aus Mails, iCal-Feed
- [x] Regeln in `packages/core` umsetzen und alle Grenzfälle per Unit-Test abdecken
- [x] Umstieg von Directus auf Payload CMS (Lizenz, Rechte als Code)
- [x] Docker-Stack lokal getestet
- [ ] Installation auf dem Server mit HTTPS und SMTP erproben (`docs/installation.md`)
- [ ] RIS-Abgleich und Regeln auf dem Server schalten
- [ ] iCal-Abo auf echten Geräten testen
- [ ] Backups einrichten und Wiederherstellung testen
- [ ] Impressum und Datenschutz ausfüllen und prüfen lassen
- [ ] Eigenes Postfach für den Beirat einrichten
- [ ] Konzept im Beirat vorstellen und abstimmen, dann Pilotbetrieb über einige Sitzungen
