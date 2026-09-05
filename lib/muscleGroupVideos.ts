// Hand-picked, hand-verified YouTube overview video per muscle group --
// reputable fitness-education channels only, one per group so a user tapping
// "Watch how to train X" always gets a real, currently-live video rather
// than an auto-matched guess (unlike the per-exercise GIFs, which are
// matched programmatically against a much larger structured catalog).
export type MuscleGroupVideo = {
  videoId: string;
  title: string;
  channel: string;
};

export const MUSCLE_GROUP_VIDEOS: Record<string, MuscleGroupVideo> = {
  back: {
    videoId: 'jLvqKgW-_G8',
    title: 'The Best And Worst Back Exercises (Ranked By Science)',
    channel: 'Jeff Nippard',
  },
  biceps: {
    videoId: 'gozU3CUIizs',
    title: 'The PERFECT Biceps Workout (Sets and Reps Included)',
    channel: 'ATHLEAN-X',
  },
  calves: {
    videoId: '21inrjhoFkQ',
    title: 'The Most Scientific Way to Train Calves',
    channel: 'Jeff Nippard',
  },
  'cardiovascular system': {
    videoId: 'T7WsVtLIZEs',
    title: "Cardio Workout Confusion - What's The Best Cardio for Fat Loss",
    channel: 'ATHLEAN-X',
  },
  chest: {
    videoId: 'NsEbXsTwas8',
    title: 'The Best & Worst Chest Exercises To Build Muscle (Ranked!)',
    channel: 'Jeff Nippard',
  },
  core: {
    videoId: 'qk97w6ZmV90',
    title: 'The PERFECT Abs Workout (Sets and Reps Included)',
    channel: 'ATHLEAN-X',
  },
  glutes: {
    videoId: '3ryh7PNhz3E',
    title: 'The Best & Worst Glute Exercises (According To Science)',
    channel: 'Jeff Nippard',
  },
  hamstrings: {
    videoId: '0a_fVS2s4Ho',
    title: 'The Most Effective Way to Train Hamstrings',
    channel: 'Jeff Nippard',
  },
  legs: {
    videoId: '8zWDuWKdBZU',
    title: 'The Perfect Leg Day (According To Science)',
    channel: 'Jeff Nippard',
  },
  quadriceps: {
    videoId: 'kIXcoivzGf8',
    title: 'The Best & Worst Quad Exercises (Ranked Using Science)',
    channel: 'Jeff Nippard',
  },
  shoulders: {
    videoId: 'tZafawk3arc',
    title: 'Shoulder Exercises Ranked (Best To Worst!)',
    channel: 'ATHLEAN-X',
  },
  triceps: {
    videoId: 'OpRMRhr0Ycc',
    title: 'The Best & Worst Triceps Exercises (Ranked Using Science)',
    channel: 'Jeff Nippard',
  },
};

export function getMuscleGroupVideo(muscle: string): MuscleGroupVideo | null {
  return MUSCLE_GROUP_VIDEOS[muscle.toLowerCase()] ?? null;
}
