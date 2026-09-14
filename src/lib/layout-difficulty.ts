export const DIFFICULTY_READY_ROUNDS = 100;

export type LayoutDifficultyStats = {
    roundsCount: number;
    avgDiffToPar: number;
    pctUnderPar: number;
    pctOverPar: number;
    pctWithinPar: number;
};

export function evaluateLayoutDifficulty(stats: LayoutDifficultyStats) {
    const rawScore = stats.pctOverPar * 40
        - stats.pctUnderPar * 40
        + stats.avgDiffToPar * 10;
    const score = Math.round(Math.max(0, Math.min(100, rawScore)) * 10) / 10;
    const suggestedDifficulty = score < 20 ? 1 : score < 40 ? 2 : score < 60 ? 3 : score < 80 ? 4 : 5;
    const suggestedParRating = [0, 860, 880, 910, 940, 980][suggestedDifficulty];
    return { score, suggestedDifficulty, suggestedParRating };
}

export function difficultyLabel(value: number | null) {
    return value != null && value >= 1 && value <= 5
        ? ["", "Easy", "Normal", "Moderate", "Advanced", "Pro"][value]
        : "Not set";
}
