/** Refero Linear Midnight — TypeScript mirrors of the CSS tokens in index.css. */
export const BEDROCK_VOID = '#08090a';
export const CARBON = '#0f1011';
export const OBSIDIAN = '#161718';
export const GRAPHITE_BORDER = '#23252a';
export const SMOKE_DIVIDER = '#383b3f';
/** Reserved exclusively for the single primary action per view (Submit). */
export const ACID_LIME = '#e4f222';
export const PULSE_GREEN = '#27a644';
export const AMBER = '#f59e0b';
export const CORAL_RED = '#eb5757';
export const TEXT_PRIMARY = '#f7f8f8';
export const TEXT_SECONDARY = '#8a8f98';
export const TEXT_MUTED = '#575a61';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  Easy: PULSE_GREEN,
  Medium: AMBER,
  Hard: CORAL_RED,
};
