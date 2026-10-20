export interface HttpAntwort {
  status: number;
  text: string;
}

export interface Http {
  holen(url: string): Promise<HttpAntwort>;
}

export interface HttpOptionen {
  userAgent: string;
  /** Pause zwischen zwei Abrufen beim RIS, in Millisekunden */
  pauseMs?: number;
  /** Wie lange Antworten wiederverwendet werden */
  cacheSekunden?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  jetzt?: () => number;
}

/**
 * Höflicher HTTP-Zugriff: erkennbarer User-Agent, Pause zwischen den Abrufen,
 * kurzer Cache. Nur erfolgreiche Antworten (2xx) kommen in den Cache.
 */
export function standardHttp(o: HttpOptionen): Http {
  const fetchFn = o.fetchFn ?? fetch;
  const jetzt = o.jetzt ?? Date.now;
  const cache = new Map<string, { bis: number; antwort: HttpAntwort }>();
  let letzter = 0;

  return {
    async holen(url) {
      const treffer = cache.get(url);
      if (treffer && treffer.bis > jetzt()) return treffer.antwort;

      const warten = (o.pauseMs ?? 1000) - (jetzt() - letzter);
      if (warten > 0) await new Promise((r) => setTimeout(r, warten));
      letzter = jetzt();

      const res = await fetchFn(url, {
        headers: { "user-agent": o.userAgent, accept: "text/html,text/calendar;q=0.9,*/*;q=0.5" },
        signal: AbortSignal.timeout(o.timeoutMs ?? 20_000),
      });
      const antwort: HttpAntwort = { status: res.status, text: await res.text() };
      if (res.ok) cache.set(url, { bis: jetzt() + (o.cacheSekunden ?? 1800) * 1000, antwort });
      return antwort;
    },
  };
}
