import type { Endpoint, PayloadRequest } from 'payload'
import { Readable } from 'node:stream'
import * as h from '@beirat-dabei/handlers'
import { speicherAusPayload } from '../speicher'

function abhaengigkeiten(req: PayloadRequest): h.OeffentlichAbhaengigkeiten {
  const geheimnis = process.env.MAGIC_LINK_SECRET
  if (!geheimnis) throw new Error('MAGIC_LINK_SECRET ist nicht gesetzt.')
  return {
    speicher: speicherAusPayload(req.payload),
    geheimnis,
    jetzt: () => new Date(),
    publicUrl: process.env.PUBLIC_URL ?? '',
    sitzungsdauerStunden: Number(process.env.SITZUNGSDAUER_STUNDEN ?? 3),
  }
}

/** Antwort der Handler in eine Web-Response umsetzen. */
const ANZEIGBAR = new Set(['application/pdf', 'image/png', 'image/jpeg'])

function antwort(a: h.Antwort): Response {
  const kopf = new Headers(a.kopf ?? {})
  if (a.datei) {
    // Nur PDF und gängige Bilder werden im Browser angezeigt, alles andere als Download
    const sicher = a.datei.name.replace(/[^\w.\-]+/g, '_')
    const art = ANZEIGBAR.has(a.datei.typ) ? 'inline' : 'attachment'
    kopf.set('content-type', a.datei.typ)
    kopf.set('content-disposition', `${art}; filename="${sicher}"; filename*=UTF-8''${encodeURIComponent(a.datei.name)}`)
    kopf.set('x-content-type-options', 'nosniff')
    kopf.set('cache-control', 'public, max-age=300')
    if (a.datei.groesse) kopf.set('content-length', String(a.datei.groesse))
    return new Response(Readable.toWeb(a.datei.stream as Readable) as ReadableStream, { status: 200, headers: kopf })
  }
  if (a.typ) {
    kopf.set('content-type', a.typ)
    return new Response(String(a.body), { status: a.status, headers: kopf })
  }
  return Response.json(a.body, { status: a.status, headers: kopf })
}

const nutzerId = (req: PayloadRequest): string | null => (req.user ? String(req.user.id) : null)
const body = async (req: PayloadRequest) => {
  try {
    return (await req.json?.()) ?? {}
  } catch {
    return {}
  }
}

export const endpoints: Endpoint[] = [
  {
    path: '/beirat-dabei/dashboard',
    method: 'get',
    handler: async (req) => antwort(await h.dashboard(abhaengigkeiten(req), nutzerId(req))),
  },
  {
    path: '/beirat-dabei/teilnahme',
    method: 'post',
    handler: async (req) => antwort(await h.teilnahme(abhaengigkeiten(req), nutzerId(req), await body(req))),
  },
  {
    path: '/beirat-dabei/notiz',
    method: 'post',
    handler: async (req) => antwort(await h.notiz(abhaengigkeiten(req), nutzerId(req), await body(req))),
  },
  {
    path: '/beirat-dabei/notiz/loeschen',
    method: 'post',
    handler: async (req) => antwort(await h.notizLoeschen(abhaengigkeiten(req), nutzerId(req), await body(req))),
  },
  {
    path: '/beirat-dabei/abo',
    method: 'get',
    handler: async (req) => antwort(await h.abo(abhaengigkeiten(req), nutzerId(req))),
  },
  {
    path: '/beirat-dabei/ical/:token',
    method: 'get',
    handler: async (req) => antwort(await h.ical(abhaengigkeiten(req), String(req.routeParams?.token ?? ''))),
  },
  // Öffentlich, durch signierten Token geschützt
  {
    path: '/beirat-dabei/link/:token',
    method: 'get',
    handler: async (req) => antwort(await h.linkInfo(abhaengigkeiten(req), String(req.routeParams?.token ?? ''))),
  },
  {
    path: '/beirat-dabei/link/:token',
    method: 'post',
    handler: async (req) => antwort(await h.linkBestaetigen(abhaengigkeiten(req), String(req.routeParams?.token ?? ''), await body(req))),
  },
  // Öffentlich, ohne Anmeldung: Name, Termine, veröffentlichte Unterlagen
  { path: '/beirat-dabei/instanz', method: 'get', handler: async (req) => antwort(await h.instanz(abhaengigkeiten(req))) },
  { path: '/beirat-dabei/oeffentlich', method: 'get', handler: async (req) => antwort(await h.oeffentlich(abhaengigkeiten(req))) },
  { path: '/beirat-dabei/rechtliches', method: 'get', handler: async (req) => antwort(await h.rechtliches(abhaengigkeiten(req))) },
  {
    path: '/beirat-dabei/datei/:id',
    method: 'get',
    handler: async (req) => antwort(await h.datei(abhaengigkeiten(req), String(req.routeParams?.id ?? ''))),
  },
]
