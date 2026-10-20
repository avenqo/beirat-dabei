#!/usr/bin/env bash
# Spielt ein Archiv von scripts/backup.sh ein.
#
#   scripts/restore.sh [--yes] backups/beirat-dabei-20261020-070000.tar.gz
#
# Die bisherigen Daten werden nicht gelöscht, sondern nach DATA_DIR/vorher-<Zeit> verschoben.
# Läuft der Stack, wird Directus für die Dauer der Wiederherstellung gestoppt.
#
# Einstellungen (Umgebungsvariablen, alle optional):
#   DATA_DIR   Datenverzeichnis des Stacks (Standard: ./data)
#   COMPOSE    Compose-Befehl              (Standard: docker compose)
#
# Wichtig: Als Benutzer ausführen, dem das Datenverzeichnis gehört, damit die Dateirechte
# für den Container passen. Die Rechte der bestehenden Datenbankdatei werden übernommen.

set -euo pipefail
cd "$(dirname "$0")/.."

DATA_DIR="${DATA_DIR:-./data}"
COMPOSE="${COMPOSE:-docker compose}"
ja=0

fehler() { echo "Fehler: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y) ja=1; shift;;
    -h|--help) sed -n '2,12p' "$0"; exit 0;;
    -*) fehler "unbekannte Option: $1";;
    *) break;;
  esac
done
[ $# -eq 1 ] || fehler "Aufruf: scripts/restore.sh [--yes] <Archiv>"
archiv="$1"
[ -f "$archiv" ] || fehler "Archiv nicht gefunden: $archiv"

# Dateien sollen für den Container lesbar bleiben; das Arbeitsverzeichnis ist durch mktemp privat.
umask 022
tmp="$(mktemp -d)"
neustart=0
aufraeumen() {
  rm -rf "$tmp"
  if [ "$neustart" = 1 ]; then
    echo "Starte Directus …" >&2
    $COMPOSE start directus >/dev/null || echo "Warnung: Directus konnte nicht gestartet werden." >&2
  fi
}
trap aufraeumen EXIT

# Archiv prüfen, bevor irgendetwas angefasst wird
tar -tzf "$archiv" >/dev/null 2>&1 || fehler "kein lesbares Archiv: $archiv"
tar -tzf "$archiv" | grep -qx 'database/data.db' || fehler "das Archiv enthält keine database/data.db"
tar -xzf "$archiv" --no-same-permissions -C "$tmp"
if command -v sqlite3 >/dev/null 2>&1; then
  pruefung="$(sqlite3 "$tmp/database/data.db" 'PRAGMA integrity_check;' 2>&1 || true)"
  [ "$pruefung" = "ok" ] || fehler "Integritätsprüfung des Archivs fehlgeschlagen: $pruefung"
fi

echo "Archiv:  $archiv"
[ -f "$tmp/MANIFEST.txt" ] && sed 's/^/  /' "$tmp/MANIFEST.txt"
echo "Ziel:    $DATA_DIR (bisherige Daten werden nach $DATA_DIR/vorher-<Zeit> verschoben)"

if [ "$ja" != 1 ]; then
  [ -t 0 ] || fehler "keine Eingabe möglich, bitte --yes angeben"
  printf 'Wiederherstellen? [j/N] '
  read -r antwort
  case "$antwort" in j|J|ja|Ja) ;; *) echo "Abgebrochen."; exit 1;; esac
fi

if [ -n "$($COMPOSE ps --status running -q directus 2>/dev/null || true)" ]; then
  echo "Stoppe Directus …"
  $COMPOSE stop directus >/dev/null
  neustart=1
fi

zeit="$(date +%Y%m%d-%H%M%S)"
vorher="$DATA_DIR/vorher-$zeit"
mkdir -p "$vorher/database" "$vorher/uploads" "$DATA_DIR/database" "$DATA_DIR/uploads"

# Inhalt der bestehenden Verzeichnisse beiseite legen. Die Verzeichnisse selbst bleiben
# (mit Besitzer und Rechten) bestehen, damit der Container weiter zugreifen kann.
alt_db="$DATA_DIR/database/data.db"
modus=""
[ -f "$alt_db" ] && modus="$(stat -c %a "$alt_db" 2>/dev/null || stat -f %Lp "$alt_db" 2>/dev/null || true)"
for d in database uploads; do
  find "$DATA_DIR/$d" -mindepth 1 -maxdepth 1 -exec mv {} "$vorher/$d/" \;
done

mv "$tmp/database/data.db" "$DATA_DIR/database/data.db"
[ -n "$modus" ] && chmod "$modus" "$DATA_DIR/database/data.db"
if [ -d "$tmp/uploads" ]; then
  find "$tmp/uploads" -mindepth 1 -maxdepth 1 -exec mv {} "$DATA_DIR/uploads/" \;
fi

echo "Fertig. Die bisherigen Daten liegen in $vorher (nach erfolgreicher Prüfung löschen)."
