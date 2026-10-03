'use client';

import { useParams } from 'next/navigation';
import TournamentLivePage from '@/components/tournament-live/TournamentLivePage';

export default function PublicTournamentRound() {
  const { tournamentId, roundId } = useParams<{ tournamentId: string; roundId: string }>();
  return <TournamentLivePage key={`${tournamentId}:${roundId}`} tournamentId={tournamentId} roundId={roundId} />;
}
