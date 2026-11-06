# Beirat dabei – Produktvorstellung (Inhalte)

Stand: Entwurf für eine Präsentation. Reihenfolge und Wortlaut sind so gewählt, dass daraus später Folien werden können.

## In einem Satz

**Beirat dabei** sorgt dafür, dass bei jeder Sitzung eines Ausschusses jemand von eurem Beirat im Publikum sitzt und dass festgehalten wird, was wichtig war.

## 1. Das Problem

Beiräte, Ortsbeiräte und Bürgerinitiativen wollen die öffentlichen Ausschusssitzungen ihrer Kommune verfolgen. In der Praxis hängt das an einzelnen Menschen:

- Jemand muss im Ratsinformationssystem (RIS) nach Terminen und Tagesordnungen suchen.
- Jemand muss Freiwillige ansprechen, und oft meldet sich niemand rechtzeitig.
- Rückmeldungen und Notizen kommen spät, liegen in Chats oder fehlen ganz.
- Verlässt diese eine Person den Beirat, ist das Wissen und der Ablauf weg.

Das Ergebnis: verpasste Sitzungen, verpasste Fristen, verlorenes Wissen.

## 2. Die Lösung

Eine kleine Webanwendung, die pro Beirat läuft. Sie holt die Sitzungstermine automatisch aus dem RIS, zeigt sie an einem Ort und meldet sich nur dann, wenn etwas zu tun ist.

| Baustein | Was er tut |
| --- | --- |
| Dashboard | alle Sitzungen mit Datum, Ort, Tagesordnung, Teilnehmenden und Notizen |
| Teilnahme per Link | eine Mail mit persönlichem Link, eine Bestätigung, keine Anmeldung nötig |
| Kurznotiz | wenige Fragen nach der Sitzung, gemeinsam geschrieben, nach Jahr geordnet und durchsuchbar |
| Benachrichtigungen | fünf feste Regeln mit einstellbaren Fristen |
| Kalender-Abo | alle Termine im eigenen Kalender, aktualisiert sich von selbst |
| Öffentliche Seite | nächste Sitzungen und veröffentlichte Unterlagen für alle, ohne Anmeldung |

## 3. Vorteile

- **Weniger Koordinationsaufwand.** Das System erinnert, nicht eine Person. Niemand muss mehr das RIS beobachten.
- **Verlässlich.** Die Benachrichtigungen folgen festen, getesteten Regeln und keiner KI. Eine Frist greift jedes Mal.
- **Niedrige Hürde.** Läuft im Browser, keine App, kein Passwort nötig, um sich für eine Sitzung einzutragen.
- **Das Wissen bleibt.** Notizen sind gemeinsam, bleiben über Jahre erhalten und lassen sich nach Themen durchsuchen. Die Übergabe an Nachfolgende ist eine Rollenzuweisung.
- **Sichtbar nach außen.** Termine, Geschäftsordnung, Stellungnahmen und Tätigkeitsberichte stehen auf einer öffentlichen Seite.
- **Datensparsam und unabhängig.** Jeder Beirat betreibt seine eigene Instanz mit eigener Datenbank. Gespeichert werden nur Name, E-Mail-Adresse, Teilnahmen und Notizen der Mitglieder. Es gibt keinen Plattformbetreiber, der alle Daten hat.
- **Günstig im Betrieb.** Ein kleiner Server genügt. Die Datenbank ist eine einzige Datei, Backup und Wiederherstellung sind Skripte.
- **Offen.** Der Quellcode steht unter der EUPL-1.2. Verbesserungen und neue Anbindungen kommen allen Instanzen zugute.

## 4. Was es konkret kann (Anwendungsfälle)

1. **Eine neue Tagesordnung erscheint.** Das System erkennt sie im RIS und schickt allen Mitgliedern eine Mail mit Link zur Tagesordnung und dem Knopf „Ich nehme teil“.
2. **Eine Woche vor der Sitzung hat sich noch niemand eingetragen.** Alle bekommen eine Erinnerung. Im Dashboard erscheint oben ein roter Hinweis „Dringend“.
3. **Jemand trägt sich ein.** Die anderen erfahren es sofort. Trägt sich in der letzten Woche vor der Sitzung die letzte Person aus, werden alle gewarnt.
4. **Nach der Sitzung.** Die Teilnehmenden beantworten wenige Fragen, zum Beispiel: War etwas Relevantes dabei? Welche TOPs? Was wurde beschlossen? Fehlt die Notiz nach drei Tagen, kommt eine Erinnerung. Wer nicht eingetragen war, kann sich nachträglich mit „Ich war dabei“ eintragen.
5. **Eine Sitzung wird verschoben oder abgesagt.** Das System erkennt es im RIS, informiert die Eingetragenen und aktualisiert den Kalender.
6. **Die Sitzungen im eigenen Kalender.** Ein persönlicher Link zeigt alle Termine mit Ort, Teilnehmenden und Tagesordnung.
7. **Bürgerinnen und Bürger informieren sich.** Auf der öffentlichen Seite stehen die nächsten Termine und die veröffentlichten Unterlagen.
8. **Zwei Jahre später.** Wer wissen will, was der Beirat zum Solarpark gesagt hat, sucht in den Notizen und findet die Sitzungen mit Beschlüssen.
9. **Wechsel im Vorstand.** Neue Administrierende bekommen eine Rolle. Alles Wissen und die Einstellungen bleiben.

## 5. Wiederverwendbarkeit

Der **Kern** ist für jeden Beirat gleich: Dashboard, Teilnahme, Notizen, Benachrichtigungen, Kalender, öffentliche Seite. Was ortsspezifisch ist, wird **pro Instanz eingestellt**, ohne Programmieren:

| Allgemein (Kern) | Pro Instanz einstellbar |
| --- | --- |
| Dashboard, Teilnahme, Notizen, Kalender | Name und Logo |
| Benachrichtigungsregeln | Fristen vor und nach der Sitzung |
| Kurznotiz | die Fragen im Formular |
| Gremien und Sitzungen | welche Gremien begleitet werden |
| Mitglieder und Administrierende | wer dabei ist |
| Anbindung an das RIS | Adapter und Adresse des RIS |

**Eine neue Instanz** ist eine Einstellungsdatei (`.env`) und ein paar Angaben in der Verwaltungsoberfläche: Name, Logo, Fristen, Notizfragen, Gremien und die Adresse des RIS. Die Installation auf einem Server beschreibt `docs/installation.md`.

**Das RIS ist austauschbar.** Der Kern spricht nur mit einer kleinen Schnittstelle: Sitzungen abrufen, Tagesordnung abrufen. Dahinter stehen Adapter:

| Adapter | Stand |
| --- | --- |
| KOMFA RIS | umgesetzt |
| Manuell (Termine von Hand pflegen) | umgesetzt |
| OParl (offener Standard) | geplant |
| iCal oder RSS | geplant |
| Andere Produkte (zum Beispiel SessionNet, ALLRIS) | nach Bedarf, als Beitrag willkommen |

**Wer es nutzen kann:** Umwelt-, Senioren-, Jugend- und Behindertenbeiräte, Ortsbeiräte, Bürgerinitiativen, grundsätzlich jede Gruppe, die öffentliche Sitzungen begleiten will.

### Beispielimplementierung: Umweltbeirat Kremmen

Die erste Instanz begleitet für den Umweltbeirat der Stadt Kremmen einen einzigen Ausschuss. So sieht die Einstellung dort aus:

| Was | Kremmen |
| --- | --- |
| Name und Adresse | Umweltbeirat Kremmen, umweltbeirat.kremmener.info |
| Begleitetes Gremium | Bau- und Umweltausschuss (im RIS: „Bau-/Wirtschafts- und Umweltausschuss“) |
| RIS | KOMFA RIS der Stadt Kremmen, Adapter `komfa` |
| Fristen | Erinnerung 7 Tage vorher, wenn niemand eingetragen ist; Notiz-Erinnerung 3 Tage danach |
| Notizfragen | War etwas Relevantes für den Beirat dabei? (ja/nein, Pflicht) · Welche TOPs waren umweltrelevant? · Was wurde beschlossen oder vertagt, und muss der Beirat etwas tun? |
| Themenfokus (für Stufe 2) | Umwelt, Natur, Klima |
| Betrieb | eigener Docker-Stack auf einem vorhandenen Server, Mails über ein Postfach des Beirats |

Alles in der Tabelle ist Einstellung, nichts davon steht im Code. Ein Senioren- oder Jugendbeirat derselben Stadt bräuchte nur andere Gremien und andere Notizfragen.

## 6. Stand und ehrliche Grenzen

**Fertig und getestet** (mit automatischen Tests, lokal im Docker-Stack und im Browser): Dashboard, Teilnahme per Link, Notizen, die fünf Regeln (zunächst im Trockenmodus), RIS-Abgleich für KOMFA gegen Beispieldaten, Kalender-Feed, öffentliche Seite, Backup und Wiederherstellung, Anmeldung und Passwort-Reset, Zugriffsregeln, Betriebsanleitung.

**Noch nicht erprobt:**
- die Installation auf einem echten Server mit HTTPS (Schritt-für-Schritt-Anleitung liegt vor)
- der Mailversand über einen echten Anbieter (bisher werden Mails im Test nur protokolliert)
- der RIS-Abgleich gegen das echte RIS der Stadt Kremmen mit der neuen Technik
- ein Pilotbetrieb mit echten Mitgliedern
- das Kalender-Abo auf echten Geräten (die Apple-Kalender-App lehnt unverschlüsselte lokale Adressen ab, im Betrieb mit HTTPS sollte es gehen)

**Bekannte Grenzen:**
- Die Oberfläche und die Mails sind deutsch und fest im Code.
- Eine Aufbewahrungsfrist mit automatischem Löschen gibt es noch nicht. Die Datenschutzunterlagen (Verzeichnis der Verarbeitungstätigkeiten, Verträge mit Hoster und Mailanbieter) liegen beim Beirat.
- Der Betrieb braucht jemanden, der einen kleinen Server einrichten kann. Danach pflegen Nicht-Entwickler alles in der Verwaltungsoberfläche.
- Technisch baut das System auf [Payload CMS](https://payloadcms.com) (MIT-Lizenz) auf. Es gibt keine Lizenzgrenzen für die Zahl der Zugänge.

## 7. Ausblick: KI-Unterstützung (Stufe 2, optional)

Später und abschaltbar, ohne Einfluss auf die festen Regeln:

- Die Tagesordnung vorsortieren: möglicherweise relevante TOPs mit einem Satz Begründung markieren.
- Beteiligungsfristen in Vorlagen erkennen, nach Bestätigung durch ein Mitglied.
- Notizen per Sprachnachricht vorausfüllen.

KI-Inhalte sind immer gekennzeichnet. Für Notizen und Aufnahmen kommt nur ein in der EU gehostetes oder lokal betriebenes Modell in Frage.

## Vorschlag für den Ablauf einer Präsentation (8 bis 10 Folien)

1. Titel mit dem Einzeiler
2. Das Problem
3. Die Lösung: So funktioniert es, vom RIS bis zur Notiz (eine Grafik)
4. Vorteile in drei bis vier Punkten
5. Anwendungsfälle als kleine Geschichte: von der Tagesordnung bis zur Notiz
6. Wissen und Außenwirkung: Notizen, Suche, öffentliche Seite
7. Wiederverwendbarkeit: Kern und Instanz
8. Datenschutz und Betrieb
9. Stand, Grenzen und nächste Schritte
10. Live-Demo (das Dashboard der Testinstanz)
