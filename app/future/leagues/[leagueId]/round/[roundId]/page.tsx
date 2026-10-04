'use client';

import { useParams } from 'next/navigation';
import TournamentLivePage from '@/components/tournament-live/TournamentLivePage';

export default function PublicLeagueRound() {
  const { leagueId, roundId } = useParams<{ leagueId: string; roundId: string }>();
  return <TournamentLivePage key={leagueId + ':' + roundId} tournamentId={leagueId} roundId={roundId} eventType="league" />;
}
