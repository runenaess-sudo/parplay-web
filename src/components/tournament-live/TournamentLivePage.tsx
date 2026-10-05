'use client';

import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { getInitials, getScoreDisplayStyle } from '@/lib/live-score-presentation';
import { isUuid, orderedClasses, selectedClass, rankedPlayers, total, relative, thru, rating, scoreState,
  publicFailure, type TournamentLive, type Failure } from '@/lib/tournament-live';
import { eventRoundUpdates, scorecardTopic, type LiveStatus } from '@/lib/event-round-updates';
import { readPublicEventRound } from '@/lib/public-event-round';
import { readTournamentView, type Overview } from '@/lib/tournament-overview';
import { compareEventClasses } from '@/lib/event-class-order';
import styles from './TournamentLivePage.module.css';

export default function TournamentLivePage({ tournamentId, roundId, eventType = 'tournament' }: { tournamentId: string; roundId: string; eventType?: 'tournament' | 'league' }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [view, setView] = useState('total');
  const requestedView = useRef('total');
  const [viewLoading, setViewLoading] = useState(false);
  const [data, setData] = useState<TournamentLive | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [liveUpdate, setLiveUpdate] = useState(true);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('connecting');
  const updates = useRef<ReturnType<typeof eventRoundUpdates<unknown>> | null>(null);
  const label = eventType === 'league' ? 'League' : 'Tournament';
  const valid = isUuid(tournamentId) && isUuid(roundId);

  useEffect(() => {
    if (!valid) return;
    requestedView.current = 'total';
    const identity = { eventType, eventId: tournamentId, roundId: eventType === 'tournament' ? 'total' : roundId };
    const updater = eventRoundUpdates({
      identity, browser: window, document, status: setLiveStatus,
      subscribe: (signal, status) => {
        const channel = supabaseBrowser.channel(scorecardTopic(identity), { config: { private: false } })
          .on('broadcast', { event: 'changed' }, ({ payload }) => signal(payload))
          .subscribe(status);
        return () => { void supabaseBrowser.removeChannel(channel); };
      },
      load: async signal => {
      const request = new AbortController();
      const abort = () => request.abort();
      signal.addEventListener('abort', abort, { once: true });
      const timeout = setTimeout(abort, 20000);
      try {
        return eventType === 'tournament'
          ? await readTournamentView(tournamentId, requestedView.current, request.signal)
          : await readPublicEventRound(eventType, tournamentId, roundId, request.signal);
      } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
    }, receive: value => {
      if ('overview' in value) {
        if (value.requested !== requestedView.current) return;
        setOverview(value.overview); setData(value.round); setView(value.view); setViewLoading(false);
      } else {
        setData(value); setClassId(id => selectedClass(value.classes, id)?.id ?? null);
      }
      setFailure(null); setUpdated(new Date());
    }, failed: error => {
      const next = publicFailure(error);
      if (!next.permanent) next.message = 'Unable to refresh right now. Use Refresh to try again.';
      setFailure(eventType === 'league' ? { ...next, message: next.message.replace('Tournament', 'League') } : next);
      // Revocation/invalid setup must not keep a previously public scoreboard visible.
      setViewLoading(false);
      if (next.permanent) { setData(null); setOverview(null); }
    }});
    updates.current = updater;
    return () => { updater.stop(); updates.current = null; };
  }, [tournamentId, roundId, valid, eventType]);

  useEffect(() => { updates.current?.setEnabled(liveUpdate); }, [liveUpdate]);

  const isTotal = eventType === 'tournament' && view === 'total' && overview !== null;
  const visible = data !== null || overview !== null;
  const classOptions = eventType === 'tournament' && overview
    ? [...overview.classes].sort((a,b) => compareEventClasses(a.code,b.code,a.id,b.id)) : orderedClasses(data?.classes ?? []);
  const activeClassId = classOptions.find(c => c.id === classId)?.id ?? classOptions[0]?.id;
  const totalClass = overview?.classes.find(c => c.id === activeClassId);
  const chooseView = (id: string) => {
    requestedView.current = id; setView(id); setViewLoading(true); setData(null); updates.current?.refresh();
  };
  const classes = orderedClasses(data?.classes ?? []);
  const current = eventType === 'tournament' ? classes.find(c => c.id === activeClassId) : selectedClass(classes, activeClassId ?? null);
  const status = data?.round.status === 'finished' ? 'Finished' : data?.round.status === 'ongoing' ? 'Live' : 'Before play';
  return <main className={styles.page}>
    <header className={styles.header}>
      <p className={styles.eyebrow}>PARPLAY · {label.toUpperCase()}</p>
      <h1>{overview?.tournament.name ?? data?.tournament.name ?? `${label} live scorecard`}</h1>
      {data && <div className={styles.statusRow}><strong>Round {data.round.round_number}</strong>
        <span className={styles.badge}>{status}</span></div>}
      <p role="status" className={styles.update}>{!valid ? `Invalid ${label} round link.` : failure
        ? `${failure.message}${visible ? ' Showing last received scores.' : ''}`
        : !visible ? 'Loading scorecard…' : updated ? `Updated ${updated.toLocaleTimeString()}` : ''}</p>
      {valid && <div className={styles.statusRow}>
        <button type="button" className={styles.chip} aria-pressed={liveUpdate}
          onClick={() => setLiveUpdate(value => !value)}>Live Update: {liveUpdate ? 'ON' : 'OFF'}</button>
        <button type="button" className={styles.chip} onClick={() => updates.current?.refresh()}>Refresh</button>
        {liveUpdate && liveStatus === 'fallback' && <small role="status">Live connection unavailable - refreshing every 4 seconds</small>}
      </div>}
    </header>
    {classOptions.length > 0 && <nav className={styles.chips} aria-label={label + ' classes'}>
      {classOptions.map(c => <button key={c.id} type="button" aria-pressed={c.id === activeClassId}
        onClick={() => setClassId(c.id)} className={styles.chip}>{c.code}</button>)}
    </nav>}
    {eventType === 'tournament' && overview && overview.rounds.length > 1 && <nav className={styles.chips} aria-label="Tournament rounds">
      {[{ id: 'total', round_number: 0 }, ...overview.rounds].map(r => <button type="button" key={r.id}
        className={styles.chip} aria-pressed={view === r.id} onClick={() => chooseView(r.id)}>
        {r.id === 'total' ? 'TOTAL' : 'RD ' + r.round_number}</button>)}
    </nav>}
    {viewLoading && <p role="status">Loading selected view…</p>}
    {!viewLoading && isTotal && totalClass && <section>
      <div className={styles.classHeader}><h2>{totalClass.code} · TOTAL</h2></div>
      <div className={styles.tableScroll}><table className={styles.table}>
        <thead><tr><th>#</th><th className={styles.player}>Player</th><th>Total</th><th>Holes played</th><th>Rounds finished / played</th></tr></thead>
        <tbody>{totalClass.players.map(p => <tr key={p.player_id}>
          <td>{p.place ?? '—'}</td><th scope="row" className={styles.player}>{p.display_name}
            {p.has_conflict && <small className={styles.conflictText}>Score discrepancy / unavailable total</small>}</th>
          <td>{relative(p.relative_to_par)}{p.provisional && !p.has_conflict && <sup>*</sup>}</td>
          <td>{p.completed_hole_count}</td><td>{p.rounds_finished} / {p.rounds_played}</td>
        </tr>)}</tbody>
      </table></div><p className={styles.legend}>* Provisional score · TOTAL includes scored holes only.</p>
    </section>}
    {!viewLoading && visible && (isTotal ? !totalClass : !current) && <section className={styles.empty}>{isTotal ? 'No scores or assigned players are available for this view.' : 'Round setup is not ready yet. No represented classes or assigned players are available.'}</section>}
    {!viewLoading && !isTotal && current && <>
      <section aria-labelledby="selected-class">
        <div className={styles.classHeader}>
          <h2 id="selected-class">{current.code}{current.name && current.name !== current.code ? ` · ${current.name}` : ''}</h2>
          <p>{current.course.name} <span>·</span> {current.layout.name}</p>
        </div>
        <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={`${current.code} live scorecard, scroll horizontally for all holes and Rating`}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>{current.code} · {current.course.name} · {current.layout.name}</caption>
            <thead><tr>
              <th scope="col" className={styles.position}>#</th><th scope="col" className={styles.player}>Player</th>
              <th scope="col">Rd</th><th scope="col">Thru</th>
              {[...current.holes].sort((a, b) => a.display_order - b.display_order).map(h => <th scope="col" key={h.hole_id}>
                {h.display_order}<small>Par {h.par}</small>{h.distance !== null && <small>{Math.round(h.distance)} m</small>}
              </th>)}
              <th scope="col">Tot</th><th scope="col">Rating</th>
            </tr></thead>
            <tbody>{rankedPlayers(current.players).map(({ player: p, place }) => <tr key={p.player_id}>
              <td className={styles.position}>{place ?? '—'}</td>
              <th scope="row" className={styles.player}><div className={styles.identity}>
                <span className={styles.avatar} aria-hidden="true">{getInitials(p.display_name)}</span>
                <span>{p.display_name}{p.has_conflict && <small className={styles.conflictText}>Score discrepancy</small>}</span>
              </div></th>
              <td>{relative(p.relative_to_par)}</td><td>{thru(p)}</td>
              {[...current.holes].sort((a, b) => a.display_order - b.display_order).map(h => {
                const score = p.scores.find(s => s.hole_id === h.hole_id);
                const state = scoreState(score);
                const display = getScoreDisplayStyle(state === 'conflict' ? null : score?.strokes ?? null, h.par);
                const label = state === 'conflict' ? 'Score discrepancy' : state === 'provisional' ? 'Provisional / awaiting scorers' : state === 'empty' ? 'No score yet' : 'Confirmed score';
                return <td key={h.hole_id} title={label} className={state === 'conflict' ? styles.conflict : undefined}>
                  <span className={`${styles.score} ${state === 'provisional' ? styles.provisional : ''}`}
                    style={{ color: display.textColor, ...display.bubbleStyle }} aria-label={`Hole ${h.display_order}: ${label}${score?.strokes != null && state !== 'conflict' ? `, ${score.strokes}` : ''}`}>
                    {state === 'conflict' ? '!' : score?.strokes ?? '—'}{state === 'provisional' && <sup>*</sup>}
                  </span>
                </td>;
              })}
              <td title={p.has_conflict ? 'Unresolved score discrepancy' : !p.is_display_complete ? 'Round in progress' : `${label} Results total`}>{total(p) ?? '—'}{p.has_conflict && ' !'}</td>
              <td title={p.rating_state === 'evolving' ? 'Current stored rating · still evolving' : p.rating_state === 'final' ? 'Final rating' : 'Rating unavailable'}>
                <span className={styles.rating}>{rating(p)}{p.round_rating !== null && p.rating_state === 'evolving' && <sup aria-label="evolving">*</sup>}</span>
              </td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className={styles.legend}>{eventType === 'league' ? 'F Finished' : "* Provisional score / evolving rating · ! Score discrepancy · F Finished"}</p>
      </section>
    </>}
  </main>;
}
