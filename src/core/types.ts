// Data model. Keep in sync with docs/SPEC.md.

export type Language = 'en' | 'hi' | 'gu';
export type Category = 'daily' | 'long_term';
/** `note` today. `qa` is reserved for question-and-answer points (a later, opt-in mode). */
export type PointKind = 'note' | 'qa';
/** How often a point comes back compared with the others: `often` about twice as much as `normal`, `rarely` about half. */
export type Pace = 'often' | 'normal' | 'rarely';

export interface Point {
  id: string;
  kind: PointKind;
  /** The words the user wrote; for a future `qa` point, the question. */
  text: string;
  /** Always null for notes. */
  answer: string | null;
  category: Category;
  /** Never shown on the lock screen or in the sky's labels. */
  private: boolean;
  /** Put away: kept, but never shown in reminders. */
  archived: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string;
  /** Approximate: booked reminders that included this point and whose time has passed. */
  appearances: number;
  lastAppearedAt: string | null;
  /** Daily points stop at this moment (local midnight after their last day) and are put away. Null: never. */
  expiresAt: string | null;
  /** Share of the turns. `normal` unless the user changes it; How often in Settings sets the base for all. */
  pace: Pace;
  /** File name of the user's own recording of this point (in the app's documents), or null. */
  voice: string | null;
}

/** A daily time range, "HH:mm" to "HH:mm"; may cross midnight. */
export interface TimeRange {
  start: string;
  end: string;
}

/** `hours`: reminders only between From and Until. `button`: all day while Awake. */
export type ActiveMode = 'hours' | 'button';


export interface Settings {
  /** Reminders run from `from` up to, not including, `to` ("HH:mm"). May cross midnight. */
  from: string;
  to: string;
  /** Minutes between reminders: one of EVERY_CHOICES (15 to 180). */
  every: number;
  /** Awake/Asleep button: nothing is booked while asleep. Asleep always wins over the hours. */
  asleep: boolean;
  mode: ActiveMode;
  /** Up to 3 daily ranges with no reminders. */
  quiet: TimeRange[];
  /** Lock screen shows only a count, never text. */
  privateMode: boolean;
  language: Language;
  /** Read each point aloud in a moment (the phone's own voice). */
  readAloud: boolean;
  /** A soft chime with each reminder. Off by default: reminders are silent. */
  sound: boolean;
}
