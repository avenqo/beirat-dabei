#!/usr/bin/env bash
# Sichert die SQLite-Datenbank und die Uploads einer Instanz in ein Archiv.
#
#   scripts/backup.sh
#
# Einstellungen (Umgebungsvariablen, alle optional):
#   DATA_DIR      Datenverzeichnis des Stacks      (Standard: ./data)
#   BACKUP_DIR    Zielverzeichnis der Archive      (Standard: ./backups)
#   BACKUP_KEEP   Anzahl der aufbewahrten Archive  (Standard: 14)
#   COMPOSE       Compose-Befehl                   (Standard: docker compose)
#
# Die Datenbank wird mit `sqlite3 .backup` gesichert. Das ist auch bei laufendem Betrieb
# konsistent. Ohne sqlite3 auf dem Host wird der Container kurz gestoppt und die Datei
# kopiert. Die Datei im laufenden Betrieb einfach zu kopieren ist nie in Ordnung.
#
# Das Archiv enthält personenbezogene Daten und wird nur für den Eigentümer lesbar angelegt.
# Die .env mit den Schlüsseln ist NICHT enthalten und muss getrennt aufbewahrt werden.

set -euo pipefail
cd "$(dirname "$0")/.."

DATA_DIR="${DATA_DIR:-./data}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
COMPOSE="${COMPOSE:-docker compose}"
DB="$DATA_DIR/database/data.db"

fehler() { echo "Fehler: $*" >&2; exit 1; }

[ -f "$DB" ] || fehler "Datenbank nicht gefunden: $DB (DATA_DIR=$DATA_DIR)"
case "$BACKUP_KEEP" in ''|*[!0-9]*) fehler "BACKUP_KEEP muss eine Zahl sein";; esac

umask 077
tmp="$(mktemp -d)"
gestoppt=0
aufraeumen() {
  rm -rf "$tmp"
  if [ "$gestoppt" = 1 ]; then
    echo "Starte Directus wieder …" >&2
    $COMPOSE start directus >/dev/null || echo "Warnung: Directus konnte nicht gestartet werden." >&2
  fi
}
trap aufraeumen EXIT

mkdir -p "$tmp/database"

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" ".backup '$tmp/database/data.db'"
  pruefung="$(sqlite3 "$tmp/database/data.db" 'PRAGMA integrity_check;' 2>&1 || true)"
  [ "$pruefung" = "ok" ] || fehler "Integritätsprüfung der Sicherung fehlgeschlagen: $pruefung"
else
  echo "Hinweis: sqlite3 fehlt auf dem Host, Directus wird kurz gestoppt." >&2
  if [ -n "$($COMPOSE ps --status running -q directus 2>/dev/null || true)" ]; then
    $COMPOSE stop directus >/dev/null
    gestoppt=1
  fi
  cp "$DB" "$tmp/database/data.db"
fi

if [ -d "$DATA_DIR/uploads" ]; then
  cp -R "$DATA_DIR/uploads" "$tmp/uploads"
else
  mkdir -p "$tmp/uploads"
fi

{
  echo "erstellt: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "version: $(git rev-parse --short HEAD 2>/dev/null || echo unbekannt)"
  echo "datenbank: $(wc -c < "$tmp/database/data.db" | tr -d ' ') Bytes"
} > "$tmp/MANIFEST.txt"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
ziel="$BACKUP_DIR/beirat-dabei-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$ziel" -C "$tmp" MANIFEST.txt database uploads

# Alte Archive entfernen, die neuesten BACKUP_KEEP bleiben.
# shellcheck disable=SC2012
ls -1t "$BACKUP_DIR"/beirat-dabei-*.tar.gz 2>/dev/null | tail -n +"$((BACKUP_KEEP + 1))" | while IFS= read -r alt; do
  rm -f -- "$alt"
done

echo "Sicherung: $ziel ($(du -h "$ziel" | cut -f1))"
