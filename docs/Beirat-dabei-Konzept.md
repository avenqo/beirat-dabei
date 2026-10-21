# Beirat dabei – Konzept

Stand: 20.10.2026 · Entwurf

**Beirat dabei** ist eine allgemeine Sitzungsbegleitung für Beiräte und Initiativen, die Ausschüsse ihrer Kommune verfolgen. Der Umweltbeirat Kremmen ist die erste Instanz. Repo und Container heißen `beirat-dabei`.

## Ausgangslage und Ziel

Ziel: Bei jeder Sitzung des Bau- und Umweltausschusses sitzt ein Mitglied des Umweltbeirats im Publikum, und was dort umweltrelevant war, ist danach festgehalten.

Die Abstimmung im Beirat erfordert heute, dass jemand Termine und Tagesordnungen im Blick behält, Freiwillige anspricht und Rückmeldungen einsammelt. Das System nimmt diese Arbeit ab. Es zeigt alle Termine an einem Ort und meldet sich nur, wenn etwas zu tun ist.

Das System wird in zwei Ausbaustufen umgesetzt:

1. **Ausbaustufe 1:** Dashboard, Teilnahme, Kurznotiz und Benachrichtigungen nach festen Regeln.
2. **Ausbaustufe 2 (optional, später):** KI-Unterstützung beim Lesen der Tagesordnungen, beim Erkennen von Fristen und beim Erfassen von Notizen.

Die Entwürfe der Oberflächen liegen im [Design-Canvas](https://claude.ai/artifact/LC4Hc6zD3mKhUgsWYcmDhb).

## Allgemeiner Kern, Kremmen als Instanz

Der Kern ist für jeden Beirat nutzbar. Ortsspezifisch sind nur die Anbindung an das Ratsinformationssystem und die Konfiguration.

| Allgemein (Kern) | Pro Instanz einstellbar | Kremmen |
| --- | --- | --- |
| Dashboard, Teilnahme, Magic Links, iCal | Name, Logo, Farben, Absender, Domain | Beirat dabei · Umweltbeirat Kremmen |
| Regel-Engine für Benachrichtigungen | Fristen vor und nach der Sitzung | 7 Tage vorher, 3 Tage danach |
| Kurznotiz | Fragen im Notizformular | drei Fragen, siehe Ausbaustufe 1 |
| Datenmodell mit Gremien | begleitete Gremien | nur Bau- und Umweltausschuss |
| Rollenmodell Mitglied/Admin | Rollennamen | `ub`, `ub-admin` |
| Schnittstelle für RIS-Adapter | Adapter und Quelle | je nach RIS der Stadt |
| KI-Vorsortierung (Stufe 2) | Themenfokus | Umwelt, Natur, Klima |

**Eine Instanz pro Beirat.** Jeder Beirat betreibt seinen eigenen Stack. Eine Plattform für viele Beiräte ist nicht vorgesehen. Das hält Rechte, Daten und Übergabe einfach.

**Kremmen bleibt der Maßstab.** Allgemein wird nur, was wenig kostet: Werte in die Konfiguration, RIS-Zugriff hinter eine Schnittstelle. Gebaut wird zunächst nur der Adapter, den Kremmen braucht.

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
| Notiz fehlt | Sitzung vorbei, keine Notiz |
| Dokumentiert | Sitzung vorbei, Notiz vorhanden |

Oben stehen die anstehenden Sitzungen, darunter die vergangenen mit ihren Notizen. Begleitet eine Instanz mehrere Gremien, kommt ein Filter nach Gremium dazu. Kremmen begleitet nur den Bau- und Umweltausschuss.

**Kurznotiz:** eine gemeinsame Notiz pro Sitzung, die alle Teilnehmenden ergänzen können. Die Fragen sind je Instanz einstellbar. Kremmen nutzt drei, nur die erste ist Pflicht:

1. War etwas Relevantes für den Beirat dabei? (ja/nein)
2. Welche TOPs waren umweltrelevant?
3. Was wurde beschlossen oder vertagt, und muss der Beirat etwas tun?

**Magic Links:** Jeder Link gilt für eine Person und eine Sitzung. Der Link öffnet eine Bestätigungsseite, erst der Knopf dort (POST) trägt ein. So lösen Mail-Scanner und Link-Vorschauen nichts aus. Danach gibt es „Rückgängig machen“. Der Token ist signiert. Links in Mails gelten bis zum Sitzungsende plus 14 Tage (einstellbar), der „Rückgängig“-Link nach dem Klick 30 Minuten. Eine Anmeldung ist nicht nötig.

**Kalender (optional):** eine persönliche iCal-Abo-Adresse mit allen Sitzungsterminen, die Mitglieder im Dashboard abrufen und in ihren eigenen Kalender übernehmen können. Der Token ist pro Mitglied abgeleitet, gesperrte Mitglieder verlieren den Zugang sofort, und über `abo_version` in den Einstellungen lassen sich alle Adressen widerrufen.

## Benachrichtigungsregeln

Fünf feste Regeln, geprüft von einem täglichen Lauf am Morgen. Die Fristen sind je Instanz einstellbar, die Werte unten gelten für Kremmen. Ein Versandprotokoll stellt sicher, dass niemand dieselbe Nachricht zweimal erhält.

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
- **Kanal:** Alle Regeln laufen in Stufe 1 per E-Mail. Push (etwa über Ortsfunk) ist ein möglicher späterer Zusatzkanal für Regel 2.

## Technische Umsetzung

Entscheidung: ein eigener Webservice auf Basis von Directus, als eigener Docker-Stack. Er läuft zunächst auf dem Ortsfunk-Server und lässt sich später auf jeden anderen Server umziehen.

**Geprüfte Optionen**

| Option | Bewertung |
| --- | --- |
| Ortsfunk-App | Backend, Login und Nutzergruppen vorhanden, Push bisher nicht personalisiert. Ortsfunk ist aber öffentlich, jedes Mitglied müsste die App installieren, und Änderungen laufen durch den Store-Review. Geeignet für den öffentlichen Teil (Sitzungstermine), nicht für den internen Ablauf. |
| KI-Agent als Kern | Fristen müssen jedes Mal zuverlässig greifen. Ein Sprachmodell ist dafür nicht deterministisch genug. Sinnvoll als Zusatz, siehe Ausbaustufe 2. |
| **Eigener Webservice (gewählt)** | Deckt Dashboard, Magic Links und iCal ohne Installation ab. Directus liefert Datenmodell, Rollen und Admin-Oberfläche. |
| Low-Code (n8n, Nextcloud) | Schnell als Pilot, aber Logik über mehrere Werkzeuge verteilt, Dashboard nur mühsam. |
| Bordmittel des RIS | Eventuell Benachrichtigung bei neuen Dokumenten. Deckt nur Regel 1 ab, wird aber als Datenquelle geprüft. |

**Eigene Instanz statt Mitnutzung von Ortsfunk.** Das Beiratssystem bekommt eine eigene Directus-Instanz und eine eigene Datenbank. So bekommen Nachfolger Adminrechte ohne Zugriff auf Ortsfunk-Daten, der Umzug ist ein Umzug von Container und Datenbank, und Störungen bleiben getrennt.

```
                     ┌─ Docker-Stack beirat-dabei ─────────────────┐
RIS der Stadt ─────▶ │  RIS-Adapter (OParl, iCal/RSS, Scraper, …)  │
                     │            │                                │
                     │            ▼                                │
                     │  Directus + SQLite (Daten, Rollen, API) ────┼──▶ Dashboard (Browser)
                     │       │                     │               │
                     │       ▼                     ▼               │
Kalender-Abo ◀───────┼─ Extension             Regeln (Hook) ──────┼──▶ E-Mail / Push
                     │  Magic Links, iCal     täglich, 5 Regeln    │         │
                     └───────▲─────────────────────────────────────┘         │
                             └──────────── Klick auf Magic Link ─────────────┘
```

Der RIS-Adapter füllt Directus. Von dort lesen das Dashboard, die Regeln und die Extension. Ein Klick auf einen Magic Link in der E-Mail landet bei der Extension und trägt ein.

**Bausteine im Docker-Stack**

| Baustein | Aufgabe |
| --- | --- |
| Directus | Datenmodell, Rollen, Admin-Oberfläche, API |
| SQLite | Daten als eine Datei im Volume, kein eigener Container |
| Directus-Extension (Endpoint) | Magic Links (signierter Token → ein- oder austragen) und iCal-Feed |
| Hook-Extension (Regeln) | die fünf Benachrichtigungsregeln, täglicher Lauf; die Logik liegt in packages/core und ist per Unit-Test abgedeckt |
| RIS-Adapter | holt Termine und Tagesordnungen über einen austauschbaren Adapter; eigenes Paket packages/ris-adapter, aufgerufen von einem Cron-Hook |
| Dashboard-Frontend | schlanke statische Seite gegen die Directus-API |

**SQLite statt Postgres.** Bei rund zehn Mitgliedern und einigen Dutzend Sitzungen pro Jahr reicht SQLite, die Standard-Datenbank im Directus-Quickstart. Die ganze Datenbank ist eine Datei, das vereinfacht Backup, Umzug und Übergabe. Einschränkung: nur eine Directus-Instanz gleichzeitig. Ein späterer Wechsel zu Postgres wäre eine Migration, ist aber nicht absehbar nötig.

**Datenmodell**

| Collection | Wichtige Felder |
| --- | --- |
| einstellungen | Singleton: Name, Absender, Fristen, Notizfragen, Themenfokus, RIS-Adapter |
| gremien | Name, Kennung im RIS, aktiv |
| sitzungen | Gremium, Datum, Ort, Link ins RIS, TO-Status, abgesagt |
| teilnahmen | Sitzung, Mitglied (`directus_users`), eingetragen am, ausgetragen am, nicht teilgenommen |
| notizen | Sitzung, relevant ja/nein, Antworten auf die Notizfragen |
| benachrichtigungen | Regel, Sitzung, Empfänger, Zeitpunkt (Versandprotokoll) |

**Anmeldung und Mitglieder.** Mitglieder sind Directus-Benutzer (`directus_users`), die Anmeldung läuft über den Directus-Login. Eine eigene Collection `mitglieder` gibt es nicht, `teilnahmen` verweisen auf `directus_users`. Als Kanal ist in Stufe 1 nur E-Mail vorgesehen.

**Grenzen der kostenlosen Directus-Lizenz (Version 12, Core).** Sie erlaubt höchstens 3 Sitze (Benutzer mit Zugang zur Admin-Oberfläche), 25 Collections und 5 Flows. Benutzerdefinierte Berechtigungsregeln gibt es nicht: keine Feldeinschränkungen, keine Filter wie „nur eigene Einträge“. Die Telemetrie lässt sich nicht abschalten. Folgen für den Entwurf:

- Mitglieder bekommen keinen Zugang zur Admin-Oberfläche (belegt keinen Sitz) und nur Lesezugriff auf Sitzungsdaten.
- Alles andere läuft über die Extension, die Rechte im Code prüft: ein- und austragen, Notizen, die Namen der Mitglieder. Mitglieder lesen `directus_users` nie direkt, E-Mail-Adressen bleiben damit verborgen.
- Bis zu drei Personen können Administrierende sein.

Der Aufbau mit Directus 11 wäre eine Alternative ohne diese Grenzen. Die Extension-Lösung funktioniert in beiden Versionen.

**Rollen in Directus (Namen je Instanz, hier Kremmen)**

| Rolle | Für wen | Rechte |
| --- | --- | --- |
| `ub` | einfache Mitglieder | Dashboard sehen, sich ein- und austragen, Notizen schreiben (Schreiben über die Extension) |
| `ub-admin` | Administrierende | zusätzlich Mitglieder und Sitzungen verwalten, Einstellungen ändern |

**RIS-Adapter.** Der Kern spricht nur mit einer kleinen Schnittstelle: Sitzungen eines Gremiums abrufen und die Tagesordnung einer Sitzung abrufen. Der Abgleich läuft alle paar Stunden und erkennt neue Sitzungen, Verschiebungen, Absagen und das Erscheinen einer Tagesordnung. Vorgesehene Adapter:

1. **OParl**, der offene Standard für Ratsinformationssysteme
2. **iCal oder RSS**, falls das RIS nur Feeds liefert
3. **Scraper** für verbreitete RIS-Produkte wie SessionNet, ALLRIS oder KOMFA RIS
4. **Manuell**, damit das System auch ohne Schnittstelle nutzbar ist

Weitere Adapter können andere Instanzen beitragen.

**Kremmen: KOMFA RIS.** Die Stadt nutzt das [KOMFA RIS](https://ris-kremmen.komfa.de/index.php?module=komfaris&action=cal). Ein OParl-Zugang und ein RSS-Feed sind nicht erkennbar. Es gibt aber pro Sitzung eine iCal-Datei und eine Tagesordnungsseite mit nummerierten TOPs, Ort, Uhrzeit, Einladung als PDF und Vorlagen. Der Kremmen-Adapter kombiniert deshalb iCal und Scraping:

1. Monatskalender der nächsten ein bis drei Monate abrufen (`action=cal`) und die Sitzungen des „Bau-/Wirtschafts- und Umweltausschusses“ mit ihrer ID herausfiltern.
2. Beginn, Ende und Ort aus der iCal-Datei der Sitzung lesen (`action=ic`).
3. Tagesordnungsseite abrufen (`action=to`). Sind TOPs vorhanden oder steht die Einladung zum Download (`action=dlg`), gilt die TO als veröffentlicht und Regel 1 greift. „Die Tagesordnung ist nicht verfügbar“ heißt: noch nicht veröffentlicht.
4. Absagen und Verschiebungen durch Vergleich mit dem letzten Abgleich erkennen. Dieselbe Sitzungs-ID mit anderem Beginn ist eine Verschiebung. Fehlt eine kommende Sitzung bei vollständigem Abruf, gilt sie als abgesagt.

Der Adapter fragt nur wenige Male am Tag ab, pausiert zwischen den Abrufen, nutzt einen Cache und sendet einen erkennbaren User-Agent. Getestet wird er gegen gespeicherte Antworten des RIS unter `packages/ris-adapter/test/fixtures/komfa/`.

**Regeln als Code statt Flows.** Die Benachrichtigungsregeln laufen als Hook-Extension, nicht als Directus-Flows. Flows liegen in der Datenbank, sind schwer zu testen und schlecht zu reviewen. Für kleine Automationen einzelner Instanzen bleiben Flows nutzbar.

**Testbarkeit.** Fristen, Regeln, Magic-Link-Token und iCal sind reine Funktionen in `packages/core`: Eingabe ist der Zustand, Ausgabe sind die fälligen Nachrichten. Unit-Tests decken sie vollständig ab, auch die Grenzfälle aus dem Regelabschnitt. Die Adapter werden gegen gespeicherte RIS-Antworten getestet und sind so unabhängig vom echten RIS.

**Ortsfunk als Zusatzkanal.** Später können die öffentlichen Sitzungstermine mit Link zur TO in Ortsfunk erscheinen. Personalisierter Push für eine Gruppe „Beirat“ wäre ein weiterer Kanal für Regel 2. Interne Daten bleiben im Beiratssystem.

## Betrieb und Übergabe

Das System muss ohne seinen Erbauer weiterlaufen: In diesem Fall übernehmen andere Beiratsmitglieder den Betrieb.

- **Konfiguration als Code.** Schema, Rollen und Berechtigungen liegen im Git-Repo, angelegt durch `scripts/schema-anwenden.mjs`. Das Skript ist idempotent und lässt sich auf jeder frischen Instanz ausführen. Es ersetzt directus-sync, das mit Directus 12 nicht geprüft ist.
- **Ein Stack, eine Datei.** `docker-compose.yml` plus `.env`. Der Umzug auf einen anderen Server ist Repo und Datenbankdatei kopieren, dann starten.
- **Funktionsadressen statt persönlicher Konten.** Ein SMTP-Konto, das dem Beirat gehört (etwa umweltbeirat@…), und eine Domain umweltbeirat.[ort].de. Bei einem Domainwechsel ändern sich alle Links in alten E-Mails.
- **Admins über eine Rolle.** Administrieren kann, wer die Rolle `ub-admin` hat. Die Übergabe ist damit eine Rollenzuweisung in Directus.
- **Backup und Restore als Skript.** Gesichert werden die SQLite-Datei und die Uploads. Die Datei wird mit `sqlite3 .backup` gesichert oder bei kurz gestopptem Container kopiert, nie einfach im laufenden Betrieb. Die Wiederherstellung verschiebt die bisherigen Daten beiseite statt sie zu löschen und wird einmal getestet.
- **Betriebsanleitung im README** für Nicht-Entwickler: starten, aktualisieren, Mitglied anlegen, Backup einspielen.

**Repo-Aufteilung.** Der allgemeine Kern liegt öffentlich in `beirat-dabei`, mit einer vollständigen Beispielkonfiguration unter `examples/kremmen/` ohne Geheimnisse. Die `.env` der Kremmener Instanz mit SMTP-Zugang und Schlüsseln liegt nur auf dem Server.

**Neue Instanz.** Die Startkonfiguration steht in einer `instanz.yaml` (Name, Gremien, Fristen, Notizfragen, Rollennamen, Adapter, Themenfokus). `scripts/instanz-anwenden.sh` überträgt sie nach Directus. Danach ist Directus maßgeblich, damit Admins Fristen und Texte in der Oberfläche ändern können. Die vollständige Verzeichnisstruktur steht in der README.

**Datenschutz.** Gespeichert werden Name, E-Mail-Adresse, bevorzugter Kanal, Teilnahmen und Notizen. Zugriff haben nur Beiratsmitglieder mit der Rolle `ub` oder `ub-admin`.

## Ausbaustufe 2: KI-Unterstützung (optional, später)

Die KI übernimmt das Lesen und Formulieren, die festen Regeln aus Stufe 1 bleiben unverändert. Der Themenfokus der Vorsortierung ist je Instanz einstellbar, für Kremmen Umwelt, Natur und Klima. Stufe 2 beginnt erst, wenn Stufe 1 stabil läuft.

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

**Einbindung.** Bei „TO veröffentlicht“ oder „Sprachnachricht eingegangen“ ruft ein Hook einen kleinen Agent-Worker im selben Stack auf. Der schreibt seine Ergebnisse in eigene Felder zurück, etwa `relevante_tops` oder `fristen`.

**Spätere Ideen:** Abgleich der Notiz mit der offiziellen Niederschrift, Suche über das Archiv aller Notizen, Entwürfe für Stellungnahmen und den Jahresbericht.

## Offene Fragen und nächste Schritte

**Offene Fragen**

- Welches E-Mail-Konto nutzt das System als Absender?

**Nächste Schritte**

- [ ] Konzept und Entwürfe im Beirat vorstellen und abstimmen
- [x] RIS prüfen und passenden Adapter wählen (KOMFA RIS, Adapter umgesetzt)
- [ ] Datenmodell und Rollen ub und ub-admin in Directus anlegen
- [ ] Repo-Gerüst: Compose-Datei, `.env`-Vorlage, Sync-Setup, README
- [ ] Magic-Link- und iCal-Extension bauen
- [ ] Regeln in packages/core umsetzen und alle Grenzfälle per Unit-Test abdecken
- [ ] Pilotbetrieb mit dem Beirat über einige Sitzungen
