export type FirewatchRating = 0 | 1 | 2 | 3 | 4 | 5;

export type FirewatchRatingInfo = {
  rating: FirewatchRating;
  label: string;
  shortLabel: string;
  detail: string;
};

export const FIREWATCH_RATING_OPTIONS: FirewatchRatingInfo[] = [
  {
    rating: 0,
    label: 'Clear',
    shortLabel: 'Clear',
    detail: 'No active Firewatch signal',
  },
  {
    rating: 1,
    label: 'Watch',
    shortLabel: 'Watch',
    detail: 'Mild signal',
  },
  {
    rating: 2,
    label: 'Low heat',
    shortLabel: 'Low',
    detail: 'Some review value',
  },
  {
    rating: 3,
    label: 'Heating',
    shortLabel: 'Heating',
    detail: 'Mod review recommended',
  },
  {
    rating: 4,
    label: 'Hot',
    shortLabel: 'Hot',
    detail: 'High-priority thread',
  },
  {
    rating: 5,
    label: 'Wildfire',
    shortLabel: 'Wildfire',
    detail: 'Urgent incident',
  },
];

export const FIREWATCH_THRESHOLD_RATINGS: FirewatchRating[] = [1, 2, 3, 4, 5];

const clampScore = (score: number) => Math.max(0, Math.min(100, score));

export const firewatchRatingFromScore = (score: number): FirewatchRating => {
  const normalizedScore = clampScore(Math.round(score));

  if (normalizedScore <= 0) return 0;
  if (normalizedScore <= 20) return 1;
  if (normalizedScore <= 40) return 2;
  if (normalizedScore <= 60) return 3;
  if (normalizedScore <= 80) return 4;
  return 5;
};

export const firewatchRatingInfo = (score: number): FirewatchRatingInfo => {
  const rating = firewatchRatingFromScore(score);
  switch (rating) {
    case 1:
      return {
        rating: 1,
        label: 'Watch',
        shortLabel: 'Watch',
        detail: 'Mild signal',
      };
    case 2:
      return {
        rating: 2,
        label: 'Low heat',
        shortLabel: 'Low',
        detail: 'Some review value',
      };
    case 3:
      return {
        rating: 3,
        label: 'Heating',
        shortLabel: 'Heating',
        detail: 'Mod review recommended',
      };
    case 4:
      return {
        rating: 4,
        label: 'Hot',
        shortLabel: 'Hot',
        detail: 'High-priority thread',
      };
    case 5:
      return {
        rating: 5,
        label: 'Wildfire',
        shortLabel: 'Wildfire',
        detail: 'Urgent incident',
      };
    case 0:
      return {
        rating: 0,
        label: 'Clear',
        shortLabel: 'Clear',
        detail: 'No active Firewatch signal',
      };
  }
};

export const firewatchRatingStars = (rating: FirewatchRating) =>
  '★'.repeat(rating) + '☆'.repeat(5 - rating);

export const firewatchRatingMinScore = (rating: FirewatchRating) => {
  if (rating <= 0) return 0;
  return (rating - 1) * 20 + 1;
};

export const firewatchRatingScoreRange = (rating: FirewatchRating) => {
  if (rating === 0) return '0';
  const min = firewatchRatingMinScore(rating);
  const max = rating === 5 ? 100 : rating * 20;
  return `${min}-${max}`;
};

export const firewatchRatingSummary = (score: number) => {
  const info = firewatchRatingInfo(score);
  return `${info.rating}/5 ${info.label}`;
};
