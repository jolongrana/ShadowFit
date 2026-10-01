export type Goal = 'strength' | 'muscle' | 'endurance' | 'skill' | 'general';
export type View = 'today' | 'workout' | 'progress' | 'nutrition' | 'looks' | 'settings';
export type FaceShape = 'oval' | 'round' | 'square' | 'heart' | 'oblong' | 'diamond';
export type OutfitStyle = 'casual' | 'sporty' | 'smart-casual' | 'streetwear';
export type OutfitAdvice = 'men' | 'women';
export type NutritionGoal = 'maintain' | 'gain' | 'lose';

export type Exercise = {
  id: string;
  name: string;
  cue: string;
  sets: number;
  reps: string;
  rest: number;
  tag: string;
};

export type Workout = {
  id: string;
  name: string;
  level: string;
  duration: string;
  focus: string;
  description: string;
  exercises: Exercise[];
};

export const goals: Array<{ id: Goal; label: string; detail: string; mark: string }> = [
  { id: 'strength', label: 'Build strength', detail: 'Own the basics. Add control and capacity.', mark: '01' },
  { id: 'muscle', label: 'Build muscle', detail: 'Use steady volume and control to grow.', mark: '02' },
  { id: 'endurance', label: 'Improve endurance', detail: 'Stay composed for longer efforts.', mark: '03' },
  { id: 'skill', label: 'Improve calisthenics skills', detail: 'Make the hard shapes feel inevitable.', mark: '04' },
  { id: 'general', label: 'General fitness', detail: 'Build a balanced base that lasts.', mark: '05' },
];

export const faceShapes: Array<{ id: FaceShape; label: string; detail: string }> = [
  { id: 'oval', label: 'Oval', detail: 'Balanced length and width' },
  { id: 'round', label: 'Round', detail: 'Soft angles and fuller cheeks' },
  { id: 'square', label: 'Square', detail: 'Defined jaw and similar width' },
  { id: 'heart', label: 'Heart', detail: 'Wider forehead, narrower chin' },
  { id: 'oblong', label: 'Oblong', detail: 'Longer than it is wide' },
  { id: 'diamond', label: 'Diamond', detail: 'Prominent cheekbones' },
];

export const lookRecommendations: Record<FaceShape, {
  haircuts: Record<OutfitAdvice, string[]>;
  routine: Array<{ name: string; detail: string }>;
}> = {
  oval: {
    haircuts: {
      men: ['Textured crop', 'Classic taper', 'Medium length with natural volume'],
      women: ['Collarbone-length layers', 'Soft curtain fringe', 'Jaw-length bob with movement'],
    },
    routine: [
      { name: 'Chin tuck', detail: 'Slide the chin gently back without looking down. Hold 5 seconds × 6.' },
      { name: 'Neck rotation', detail: 'Turn slowly side to side through a comfortable range. 5 each side.' },
      { name: 'Jaw release', detail: 'Rest the tongue softly and let the jaw hang loose. Breathe for 30 seconds.' },
    ],
  },
  round: {
    haircuts: {
      men: ['High taper with texture', 'Side-swept top', 'Short sides with height'],
      women: ['Long face-framing layers', 'Angled lob with a side part', 'Textured layers with crown volume'],
    },
    routine: [
      { name: 'Posture reset', detail: 'Stack ears over shoulders and take 5 slow breaths.' },
      { name: 'Chin tuck', detail: 'Slide the chin gently back without looking down. Hold 5 seconds × 6.' },
      { name: 'Jaw release', detail: 'Rest the tongue softly and let the jaw hang loose. Breathe for 30 seconds.' },
    ],
  },
  square: {
    haircuts: {
      men: ['Crew cut with taper', 'Messy medium crop', 'Classic side part'],
      women: ['Soft layers with curtain fringe', 'Textured long bob', 'Side-swept waves'],
    },
    routine: [
      { name: 'Neck rotation', detail: 'Turn slowly side to side through a comfortable range. 5 each side.' },
      { name: 'Jaw release', detail: 'Rest the tongue softly and let the jaw hang loose. Breathe for 30 seconds.' },
      { name: 'Shoulder drop', detail: 'Lift the shoulders, exhale, and let them fall. Repeat 8 times.' },
    ],
  },
  heart: {
    haircuts: {
      men: ['Layered fringe', 'Side-parted medium cut', 'Low taper with soft texture'],
      women: ['Feathered layers with side fringe', 'Collarbone-length lob', 'Chin-length bob with soft ends'],
    },
    routine: [
      { name: 'Chin tuck', detail: 'Slide the chin gently back without looking down. Hold 5 seconds × 6.' },
      { name: 'Shoulder drop', detail: 'Lift the shoulders, exhale, and let them fall. Repeat 8 times.' },
      { name: 'Jaw release', detail: 'Rest the tongue softly and let the jaw hang loose. Breathe for 30 seconds.' },
    ],
  },
  oblong: {
    haircuts: {
      men: ['Textured fringe', 'Medium layered cut', 'Classic side-swept style'],
      women: ['Chin-length bob or textured lob', 'Full or curtain fringe', 'Shoulder-length layers'],
    },
    routine: [
      { name: 'Posture reset', detail: 'Stack ears over shoulders and take 5 slow breaths.' },
      { name: 'Neck rotation', detail: 'Turn slowly side to side through a comfortable range. 5 each side.' },
      { name: 'Shoulder drop', detail: 'Lift the shoulders, exhale, and let them fall. Repeat 8 times.' },
    ],
  },
  diamond: {
    haircuts: {
      men: ['Side-swept texture', 'Layered crop', 'Soft quiff with tapered sides'],
      women: ['Soft face-framing layers', 'Side-swept fringe', 'Chin-length textured bob'],
    },
    routine: [
      { name: 'Jaw release', detail: 'Rest the tongue softly and let the jaw hang loose. Breathe for 30 seconds.' },
      { name: 'Chin tuck', detail: 'Slide the chin gently back without looking down. Hold 5 seconds × 6.' },
      { name: 'Neck rotation', detail: 'Turn slowly side to side through a comfortable range. 5 each side.' },
    ],
  },
};

export const workouts: Workout[] = [
  {
    id: 'beginner-full-body', name: 'Beginner Full Body', level: 'Foundation', duration: '18 min', focus: 'Control + capacity',
    description: 'A measured first step. Clean reps, full range, no rushing.',
    exercises: [
      { id: 'incline-pushup', name: 'Incline push-ups', cue: 'Hands under shoulders · ribs tucked', sets: 3, reps: '8–10', rest: 60, tag: 'push' },
      { id: 'bodyweight-squat', name: 'Bodyweight squats', cue: 'Knees track over toes · breathe low', sets: 3, reps: '12', rest: 60, tag: 'legs' },
      { id: 'dead-bug', name: 'Dead bug', cue: 'Low back stays heavy on the floor', sets: 3, reps: '8 / side', rest: 45, tag: 'core' },
      { id: 'reverse-lunge', name: 'Reverse lunges', cue: 'Soft touch · drive through the front foot', sets: 2, reps: '8 / side', rest: 60, tag: 'legs' },
    ],
  },
  {
    id: 'upper-body', name: 'Upper Body', level: 'Build', duration: '24 min', focus: 'Press + pull',
    description: 'A dense upper-body session built around steady tension.',
    exercises: [
      { id: 'pushup', name: 'Push-ups', cue: 'Shoulders slightly ahead of wrists', sets: 4, reps: '6–12', rest: 90, tag: 'push' },
      { id: 'table-row', name: 'Table rows', cue: 'Pull elbows toward your back pockets', sets: 4, reps: '6–10', rest: 90, tag: 'pull' },
      { id: 'pike-pushup', name: 'Pike push-ups', cue: 'Head travels toward the floor', sets: 3, reps: '6–8', rest: 90, tag: 'shoulders' },
      { id: 'scapular-pull', name: 'Scapular pulls', cue: 'Move from the shoulder blades only', sets: 3, reps: '10', rest: 60, tag: 'pull' },
    ],
  },
  {
    id: 'lower-body', name: 'Lower Body', level: 'Build', duration: '22 min', focus: 'Legs + balance',
    description: 'Slow tempo and unilateral work for legs that stay switched on.',
    exercises: [
      { id: 'split-squat', name: 'Split squats', cue: 'Front heel heavy · torso tall', sets: 3, reps: '8 / side', rest: 90, tag: 'legs' },
      { id: 'single-leg-bridge', name: 'Single-leg bridges', cue: 'Finish with glutes, not your back', sets: 3, reps: '10 / side', rest: 60, tag: 'glutes' },
      { id: 'calf-raise', name: 'Single-leg calf raises', cue: 'Pause at the top', sets: 3, reps: '12 / side', rest: 45, tag: 'calves' },
      { id: 'wall-sit', name: 'Wall sit', cue: 'Breathe behind the brace', sets: 2, reps: '30 sec', rest: 60, tag: 'legs' },
    ],
  },
  {
    id: 'core', name: 'Core', level: 'Focused', duration: '16 min', focus: 'Brace + breathe',
    description: 'Short, direct work for a trunk you can trust.',
    exercises: [
      { id: 'hollow-hold', name: 'Hollow hold', cue: 'Ribs down · reach long', sets: 4, reps: '20 sec', rest: 45, tag: 'core' },
      { id: 'side-plank', name: 'Side plank', cue: 'Push the floor away', sets: 3, reps: '20 sec / side', rest: 45, tag: 'core' },
      { id: 'bear-crawl', name: 'Bear hover', cue: 'Knees low · quiet steps', sets: 3, reps: '30 sec', rest: 60, tag: 'core' },
    ],
  },
  {
    id: 'push', name: 'Push', level: 'Build', duration: '20 min', focus: 'Chest + shoulders',
    description: 'Pressing volume with a clean line from palm to hip.',
    exercises: [
      { id: 'pushup-ladder', name: 'Push-up ladder', cue: 'Stop one rep before the grind', sets: 4, reps: '5–10', rest: 90, tag: 'chest' },
      { id: 'diamond-pushup', name: 'Close-grip push-ups', cue: 'Elbows brush the ribs', sets: 3, reps: '5–8', rest: 90, tag: 'triceps' },
      { id: 'pike-pushup-two', name: 'Pike push-ups', cue: 'Press the floor away', sets: 3, reps: '6–10', rest: 75, tag: 'shoulders' },
    ],
  },
  {
    id: 'pull', name: 'Pull', level: 'Build', duration: '22 min', focus: 'Back + grip',
    description: 'A no-nonsense pulling session using whatever is around you.',
    exercises: [
      { id: 'table-row-two', name: 'Table rows', cue: 'Chest to the edge · no shrugging', sets: 4, reps: '6–10', rest: 90, tag: 'back' },
      { id: 'towel-row', name: 'Towel isometric row', cue: 'Pull hard for 20 seconds', sets: 3, reps: '20 sec', rest: 60, tag: 'grip' },
      { id: 'reverse-snow-angel', name: 'Reverse snow angels', cue: 'Long neck · squeeze between blades', sets: 3, reps: '10', rest: 45, tag: 'back' },
    ],
  },
  {
    id: 'full-calisthenics', name: 'Full Calisthenics', level: 'Complete', duration: '32 min', focus: 'Whole body',
    description: 'The full ritual. Push, pull, legs, core — leave nothing noisy behind.',
    exercises: [
      { id: 'tempo-pushup', name: 'Tempo push-ups', cue: 'Three seconds down', sets: 4, reps: '8', rest: 90, tag: 'push' },
      { id: 'split-squat-two', name: 'Split squats', cue: 'Own the bottom position', sets: 4, reps: '8 / side', rest: 90, tag: 'legs' },
      { id: 'table-row-three', name: 'Table rows', cue: 'Pull the chest to the edge', sets: 4, reps: '8', rest: 90, tag: 'pull' },
      { id: 'hollow-hold-two', name: 'Hollow hold', cue: 'Stay long under fatigue', sets: 3, reps: '25 sec', rest: 60, tag: 'core' },
    ],
  },
];

type MealSet = { title: string; meals: string[] };

export const mealSetsByGoal: Record<NutritionGoal, MealSet[]> = {
  maintain: [
    { title: 'Breakfast', meals: ['Greek yogurt, oats + berries', 'Eggs on sourdough + greens', 'Overnight oats with peanut butter', 'Cottage cheese, banana + cinnamon'] },
    { title: 'Lunch', meals: ['Chicken rice bowl with crunchy greens', 'Tuna, white bean + lemon salad', 'Tofu soba with sesame cabbage', 'Turkey wrap with hummus + peppers'] },
    { title: 'Dinner', meals: ['Salmon, potatoes + charred broccoli', 'Turkey chili with avocado', 'Ginger beef noodles + bok choy', 'Lentil curry with basmati rice'] },
    { title: 'Snack', meals: ['Apple + a handful of almonds', 'Protein shake + frozen banana', 'Rice cakes with cottage cheese', 'Edamame with sea salt'] },
  ],
  gain: [
    { title: 'Breakfast', meals: ['Oats with milk, Greek yogurt, banana + peanut butter', 'Eggs, avocado + whole-grain toast', 'Greek yogurt bowl with granola, fruit + seeds', 'Smoothie with milk, banana, oats + nut butter'] },
    { title: 'Lunch', meals: ['Chicken, rice, avocado + olive-oil greens bowl', 'Tofu and peanut-sesame soba with edamame', 'Tuna and hummus whole-grain wrap with yogurt', 'Lentil quinoa bowl with feta and tahini'] },
    { title: 'Dinner', meals: ['Salmon, rice + roasted vegetables with olive oil', 'Chicken pesto pasta with peas', 'Beef and bean chili over rice', 'Lentil coconut curry with basmati rice + cashews'] },
    { title: 'Snack', meals: ['Trail mix with dried fruit and nuts', 'Greek yogurt with granola', 'Peanut-butter banana toast', 'Cottage cheese with fruit and seeds'] },
  ],
  lose: [
    { title: 'Breakfast', meals: ['Greek yogurt with berries, oats + chia', 'Vegetable omelet with whole-grain toast', 'Cottage cheese with fruit + cinnamon', 'Overnight oats with berries and extra yogurt'] },
    { title: 'Lunch', meals: ['Chicken and bean salad with crunchy greens', 'Tuna and white-bean salad with lemon', 'Tofu bowl with vegetables and brown rice', 'Turkey wrap with hummus, peppers + salad'] },
    { title: 'Dinner', meals: ['Salmon with roasted vegetables and potatoes', 'Turkey chili with beans and extra vegetables', 'Ginger beef with bok choy and vegetables', 'Lentil curry with vegetables and a side of rice'] },
    { title: 'Snack', meals: ['Apple with cottage cheese', 'Greek yogurt with berries', 'Carrots, peppers + hummus', 'Edamame with sea salt'] },
  ],
};