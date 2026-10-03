'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { getInitials, getScoreDisplayStyle } from '@/lib/live-score-presentation';
import { isUuid, orderedClasses, selectedClass, rankedPlayers, total, relative, thru, rating, scoreState,
  readContract, publicFailure, pollTournament, type TournamentLive, type Failure } from '@/lib/tournament-live';
import styles from './TournamentLivePage.module.css';

export default function TournamentLivePage({ tournamentId, roundId }: { tournamentId: string; roundId: string }) {
  const [data, setData] = useState<TournamentLive | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);
  const valid = isUuid(tournamentId) && isUuid(roundId);

  useEffect(() => {
    if (!valid) return;
    return pollTournament(async signal => {
      const request = new AbortController();
      const abort = () => request.abort();
      signal.addEventListener('abort', abort, { once: true });
      const timeout = setTimeout(abort, 20000);
      try {
        const result = await supabaseBrowser.rpc('get_public_tournament_live_scorecard_v1', {
          p_tournament_id: tournamentId, p_round_id: roundId,
        }).abortSignal(request.signal);
        if (result.error) throw result.error;
        return readContract(result.data, tournamentId, roundId);
      } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
    }, value => {
      setData(value); setClassId(id => selectedClass(value.classes, id)?.id ?? null);
      setFailure(null); setUpdated(new Date());
    }, error => {
      const next = publicFailure(error);
      setFailure(next);
      // Revocation/invalid setup must not keep a previously public scoreboard visible.
      if (next.permanent) setData(null);
    });
  }, [tournamentId, roundId, valid]);

  const classes = orderedClasses(data?.classes ?? []);
  const current = selectedClass(classes, classId);
  const status = data?.round.status === 'finished' ? 'Finished' : data?.round.status === 'ongoing' ? 'Live' : 'Before play';
  return <main className={styles.page}>
    <header className={styles.header}>
      <p className={styles.eyebrow}>PARPLAY · TOURNAMENT</p>
      <h1>{data?.tournament.name ?? 'Tournament live scorecard'}</h1>
      {data && <div className={styles.statusRow}><strong>Round {data.round.round_number}</strong>
        <span className={styles.badge}>{status}</span></div>}
      <p role="status" className={styles.update}>{!valid ? 'Invalid Tournament round link.' : failure
        ? `${failure.message}${data ? ' Showing last received scores.' : ''}`
        : !data ? 'Loading scorecard…' : updated ? `Updated ${updated.toLocaleTimeString()} · Refreshes automatically` : ''}</p>
    </header>
    {data && classes.length === 0 && <section className={styles.empty}>Round setup is not ready yet. No represented classes or assigned players are available.</section>}
    {current && <>
      <nav className={styles.chips} aria-label="Tournament classes">
        {classes.map(c => <button key={c.id} type="button" aria-pressed={c.id === current.id}
          onClick={() => setClassId(c.id)} className={styles.chip}>{c.code}</button>)}
      </nav>
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
              <td title={p.has_conflict ? 'Unresolved score discrepancy' : !p.is_display_complete ? 'Round in progress' : 'Tournament Results total'}>{total(p) ?? '—'}{p.has_conflict && ' !'}</td>
              <td title={p.rating_state === 'evolving' ? 'Current stored rating · still evolving' : p.rating_state === 'final' ? 'Final rating' : 'Rating unavailable'}>
                <span className={styles.rating}>{rating(p)}{p.round_rating !== null && p.rating_state === 'evolving' && <sup aria-label="evolving">*</sup>}</span>
              </td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className={styles.legend}>* Provisional score / evolving rating · ! Score discrepancy · F Finished</p>
      </section>
    </>}
  </main>;
}
