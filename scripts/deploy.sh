#!/usr/bin/env bash
# Aktualisiert eine Instanz: Backup, neuen Stand holen, bauen, starten, Version anzeigen.
#
#   scripts/deploy.sh
#
# Die Commit-Kennung wird beim Bauen eingebunden und erscheint im Fuß des Dashboards
# neben der Versionsnummer (zum Beispiel „Beirat dabei 0.2.0 · 68b629c“). So ist immer
# erkennbar, welcher Stand läuft, auch wenn die Versionsnummer nicht erhöht wurde.
#
# Einstellungen (Umgebungsvariablen, alle optional):
#   COMPOSE       Compose-Befehl   (Standard: docker compose, mit sudo, falls nötig)
#   OHNE_BACKUP   1 = kein Backup vorher (nicht empfohlen)
#   OHNE_PULL     1 = kein git pull, den ausgecheckten Stand bauen (z. B. einen Tag: git checkout v0.2.0)

set -euo pipefail
cd "$(dirname "$0")/.."

fehler() { echo "Fehler: $*" >&2; exit 1; }

if [ -z "${COMPOSE:-}" ]; then
  if docker info >/dev/null 2>&1; then COMPOSE="docker compose"; else COMPOSE="sudo docker compose"; fi
fi
export COMPOSE

[ -f .env ] || fehler ".env fehlt. Erst die Installation abschließen (docs/installation.md)."

# 1. Backup, sofern es schon eine Datenbank gibt
if [ "${OHNE_BACKUP:-}" != "1" ] && [ -f data/beirat.db ]; then
  echo "== Backup"
  scripts/backup.sh
fi

# 2. Neuen Stand holen
if [ "${OHNE_PULL:-}" != "1" ]; then
  echo "== git pull"
  git pull --ff-only
fi

# 3. Version und Commit-Kennung bestimmen
version="$(grep -m1 '"version"' app/package.json | sed -E 's/.*"version" *: *"([^"]+)".*/\1/')"
commit="$(git rev-parse --short HEAD)"
# Lokale Änderungen an versionierten Dateien kennzeichnen, damit niemand den Stand für den Commit hält
if ! git diff --quiet HEAD -- 2>/dev/null; then
  echo "Hinweis: Es gibt lokale Änderungen an versionierten Dateien. Kennzeichnung: ${commit}-lokal"
  commit="${commit}-lokal"
fi

# 4. Bauen und starten
echo "== Baue Beirat dabei ${version} (${commit})"
$COMPOSE build --build-arg GIT_COMMIT="$commit" app
$COMPOSE up -d

# 5. Warten, bis die Anwendung bereit ist
echo -n "== Warte auf die Anwendung "
for _ in $(seq 1 60); do
  if $COMPOSE ps app 2>/dev/null | grep -q "(healthy)"; then echo " bereit."; break; fi
  echo -n "."
  sleep 3
done
$COMPOSE ps app | grep -q "(healthy)" || fehler "Die Anwendung meldet sich nicht als healthy. Protokoll: $COMPOSE logs --tail 100 app"

port="$(grep -E '^PORT=' .env | tail -1 | cut -d= -f2 | tr -d '"' || true)"
if command -v curl >/dev/null 2>&1 && [ -n "$port" ]; then
  info="$(curl -s "http://127.0.0.1:${port}/beirat-dabei/instanz" || true)"
  v="$(printf '%s' "$info" | grep -o '"version":"[^"]*"' | cut -d'"' -f4 || true)"
  c="$(printf '%s' "$info" | grep -o '"commit":"[^"]*"' | cut -d'"' -f4 || true)"
  echo "== Läuft: Beirat dabei ${v:-?}${c:+ · $c}"
else
  echo "== Fertig: Beirat dabei ${version} · ${commit}"
fi
