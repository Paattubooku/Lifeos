/**
 * The first-run app tour: one page per area, in the order a day uses them.
 * Copy names the real buttons and places so people can find them afterwards.
 */
import type { Accent } from '@/ui';

export type TourIcon =
  | 'sparkles'
  | 'calendar'
  | 'droplet'
  | 'soup'
  | 'dumbbell'
  | 'scale'
  | 'moon'
  | 'footprints'
  | 'wallet'
  | 'chart'
  | 'bell'
  | 'check';

export type TourSlide = {
  id: string;
  icon: TourIcon;
  accent: Accent;
  /** Where it lives, e.g. "Today tab". */
  where: string;
  title: string;
  body: string;
  /** How to use it: 2–4 short lines. */
  how: readonly string[];
};

export const TOUR: readonly TourSlide[] = [
  {
    id: 'welcome',
    icon: 'sparkles',
    accent: 'primary',
    where: 'Welcome',
    title: 'Your whole day, one app',
    body: 'Routine, water, food, training, weight, sleep, steps, tasks and money, all on a single timeline. This tour takes about a minute.',
    how: ['Swipe or tap Next to go through it.', 'Skip any time. Replay it from More → App tour.'],
  },
  {
    id: 'today',
    icon: 'calendar',
    accent: 'primary',
    where: 'Today tab',
    title: 'Today runs your day',
    body: 'Your routine as a timeline of blocks, from wake-up to lights out. The block happening now is highlighted.',
    how: [
      'Tap a block to tick it done. Undo appears for a few seconds.',
      'Long-press a block to skip it with a reason (sick, travel, rest).',
      'The ring is your day score. 70 % or more counts as a streak day.',
      'Change blocks and times in More → Routine.',
    ],
  },
  {
    id: 'water',
    icon: 'droplet',
    accent: 'water',
    where: 'Today → Water',
    title: 'Water, at the right pace',
    body: 'Your water target spread across the day, so you know if you are behind before evening.',
    how: [
      'Tap +250 or +500 ml, or enter a custom amount.',
      'The pace line shows how far ahead or behind you are.',
      'Water blocks on Today tick themselves when you hit them.',
    ],
  },
  {
    id: 'food',
    icon: 'soup',
    accent: 'calories',
    where: 'Food tab',
    title: 'Food from your meal plan',
    body: 'Every meal of your plan with its calories and protein, counted against your targets.',
    how: [
      'Tap “Eaten as planned”, or tick each dish you ate.',
      'Use the swap button to change a dish for an alternative.',
      'Ate something else? Tap “Off-plan” and log it.',
    ],
  },
  {
    id: 'train',
    icon: 'dumbbell',
    accent: 'protein',
    where: 'Train tab',
    title: 'Workouts that progress',
    body: 'Today’s session from your program, with sets, reps and rest timers.',
    how: [
      'Start the session and log each set as you go.',
      'Hit every rep and LifeOS suggests a little more weight next time.',
      'Change exercises and days in Train → Program.',
      'Can’t train today? Long-press the workout block on Today → Move to tomorrow.',
    ],
  },
  {
    id: 'body',
    icon: 'scale',
    accent: 'success',
    where: 'Progress → Weight',
    title: 'Weight, without the noise',
    body: 'A 7-day average trend instead of one noisy number, with an honest date for reaching your goal.',
    how: [
      'Tap “Weigh in” in the morning: before breakfast, same scale.',
      'Watch the trend line, not single days.',
      'Energy balance shows your calories in versus what you burn.',
    ],
  },
  {
    id: 'sleep',
    icon: 'moon',
    accent: 'primary',
    where: 'Today and Progress → Sleep',
    title: 'Sleep and phone-off',
    body: 'A fixed bedtime and a phone-away time, because willpower runs out at night.',
    how: [
      'Answer the morning check: when you slept and woke.',
      'At phone-off time you get one blunt reminder with your score.',
      'Set up iPhone Screen Time to match: More → Settings.',
    ],
  },
  {
    id: 'steps',
    icon: 'footprints',
    accent: 'success',
    where: 'Today → Steps',
    title: 'Steps',
    body: 'A daily minimum that counts toward your day.',
    how: [
      'Tap “Count steps automatically” to use your phone’s motion sensor.',
      'Or add steps by hand.',
      'Set your daily minimum on the Steps screen.',
    ],
  },
  {
    id: 'life',
    icon: 'wallet',
    accent: 'calories',
    where: 'More',
    title: 'Tasks and money',
    body: 'The life admin that usually leaks out of your day.',
    how: [
      'Tasks: pick a Top 3 for today. They show on Today.',
      'Money: log spending in seconds and watch your monthly budgets.',
      'Bank SMS and Shortcuts can log for you: More → Integrations.',
    ],
  },
  {
    id: 'progress',
    icon: 'chart',
    accent: 'primary',
    where: 'Progress tab',
    title: 'Progress and the weekly review',
    body: 'Charts for every area, your streaks, and a short review every Sunday.',
    how: [
      'Check streaks and trends on the Progress tab.',
      'Sunday evening: a 2-minute review with your weekly grade.',
      'Pick one change for next week and it shows on Today.',
    ],
  },
  {
    id: 'nudges',
    icon: 'bell',
    accent: 'danger',
    where: 'Reminders and nudges',
    title: 'Nudges when the day slips',
    body: 'At most 10 reminders a day, and only when something is due.',
    how: [
      '3 blocks overdue? “Do ONE thing now” points you at the easiest one.',
      'Weak day after 6 pm? Quick rescue actions to save the score.',
      'Turn any reminder or nudge off in More → Reminders.',
    ],
  },
  {
    id: 'ready',
    icon: 'check',
    accent: 'success',
    where: 'You’re set',
    title: 'Start with one good day',
    body: 'Your routine, meals and workouts are an example plan. Make them yours as you go.',
    how: ['Open Today and tick your first block.', 'Replay this tour any time: More → App tour.'],
  },
];

/** Next page index, clamped. */
export const clampIndex = (i: number) => Math.max(0, Math.min(TOUR.length - 1, i));
