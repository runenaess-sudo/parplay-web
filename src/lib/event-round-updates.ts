export type RoundIdentity = { eventType: 'tournament' | 'league'; eventId: string; roundId: string };
export type LiveStatus = 'connecting' | 'live' | 'fallback' | 'off' | 'paused';
export const scorecardTopic = (id: RoundIdentity) => `public-scorecard:${id.eventType}:${id.eventId}:${id.roundId}`;

// Only invalidations enter here. The loader always reads the authoritative RPC.
export function eventRoundUpdates<T>(options: {
  identity: RoundIdentity;
  load: (signal: AbortSignal) => Promise<T>;
  receive: (value: T) => void;
  failed: (error: unknown) => void;
  status: (status: LiveStatus) => void;
  subscribe: (signal: (payload: unknown) => void, status: (value: string) => void) => () => void;
  browser: Window;
  document: Document;
}) {
  let stopped = false, enabled = true, running = false, dirty = false, manualDirty = false;
  let healthy = false, started = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  const available = () => options.document.visibilityState !== 'hidden' && options.browser.navigator.onLine !== false;
  const active = () => enabled && available() && !stopped;
  const clear = () => { clearTimeout(timer); timer = undefined; };
  const show = () => options.status(!enabled ? 'off' : !available() ? 'paused' : healthy ? 'live' : watchdog ? 'connecting' : 'fallback');
  const schedule = (delay: number) => {
    if (timer || stopped) return;
    timer = setTimeout(() => { timer = undefined; void run(); }, delay);
  };
  const run = async () => {
    if (stopped) return;
    if (running) { dirty = true; return; }
    clear();
    running = true; started = true; dirty = false; manualDirty = false;
    try { const value = await options.load(controller.signal); if (!stopped) options.receive(value); }
    catch (error) { if (!stopped) options.failed(error); }
    finally {
      running = false;
      if (!stopped && (manualDirty || (dirty && active()))) schedule(250);
      else if (active() && !healthy && !watchdog) schedule(4000);
    }
  };
  const request = (manual = false) => {
    if (stopped || (!manual && !active())) return;
    if (running) { dirty = true; manualDirty ||= manual; return; }
    clear(); schedule(250);
  };
  const onSignal = (payload: unknown) => {
    const p = payload as { event_type?: string; event_id?: string; round_id?: string } | null;
    if (p?.event_type === options.identity.eventType && p.event_id === options.identity.eventId && p.round_id === options.identity.roundId) request();
  };
  const onStatus = (status: string) => {
    if (stopped) return;
    if (status === 'SUBSCRIBED') {
      const recovered = !healthy;
      healthy = true; clearTimeout(watchdog); watchdog = undefined; clear();
      // Close the read/subscribe gap, and catch up after socket reconnection.
      if (recovered && started) request();
    } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
      healthy = false; clearTimeout(watchdog); watchdog = undefined;
      if (active() && !running) { clear(); schedule(4000); }
    }
    show();
  };
  const pause = () => { if (!available()) { clear(); dirty = false; } show(); };
  const catchUp = () => { if (available()) request(); else pause(); show(); };
  options.browser.addEventListener('online', catchUp);
  options.browser.addEventListener('offline', pause);
  options.document.addEventListener('visibilitychange', catchUp);
  watchdog = setTimeout(() => onStatus('TIMED_OUT'), 10000);
  let unsubscribe = () => {};
  try { unsubscribe = options.subscribe(onSignal, onStatus); }
  catch { onStatus('CHANNEL_ERROR'); }
  show();
  void run();
  return {
    refresh: () => request(true),
    setEnabled(value: boolean) {
      if (stopped || value === enabled) return;
      enabled = value; clear(); dirty = false; manualDirty = false;
      if (enabled) request();
      show();
    },
    stop() {
      stopped = true; clear(); clearTimeout(watchdog); controller.abort(); unsubscribe();
      options.browser.removeEventListener('online', catchUp);
      options.browser.removeEventListener('offline', pause);
      options.document.removeEventListener('visibilitychange', catchUp);
    },
  };
}
