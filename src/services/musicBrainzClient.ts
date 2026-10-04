const baseUrl = "https://musicbrainz.org/ws/2";
export const musicBrainzPauseMs = 1100;
let queue: Promise<unknown> = Promise.resolve();
let nextRequestAt = 0;

export function musicBrainzRequest<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  // Search, discography and member lookups share MusicBrainz's one-request-per-second limit.
  const request = queue.catch(() => undefined).then(async () => {
    signal?.throwIfAborted();
    const wait = Math.max(0, nextRequestAt - Date.now());
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    signal?.throwIfAborted();
    nextRequestAt = Date.now() + musicBrainzPauseMs;
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, 15000);
    try {
      const response = await fetch(`${baseUrl}/${path}?${new URLSearchParams({ ...params, fmt: "json" })}`, {
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`MusicBrainz could not load this data (${response.status}).`);
      return await response.json() as T;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  });
  queue = request;
  return request;
}
