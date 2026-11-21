// Data model. Keep in sync with docs/SPEC.md.

export type Language = 'en' | 'hi' | 'gu';
export type Category = 'daily' | 'long_term';
/** `note` today. `qa` is reserved for question-and-answer points (a later, opt-in mode). */
export type PointKind = 'note' | 'qa';

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
}

/** How often reminders come. Minutes between them: often 30, regular 60, gentle 120. */
export type Pace = 'often' | 'regular' | 'gentle';

export interface Settings {
  /** Reminders run from `from` up to, not including, `to` ("HH:mm"). May cross midnight. */
  from: string;
  to: string;
  pace: Pace;
  /** Pause button: nothing is booked while paused. */
  paused: boolean;
  /** Lock screen shows only a count, never text. */
  privateMode: boolean;
  language: Language;
}
