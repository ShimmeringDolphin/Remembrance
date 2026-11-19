// Core data model for Remembrance. Keep in sync with docs/SPEC.md.

export type Language = 'en' | 'hi' | 'gu';
export type Category = 'daily' | 'long_term';
export type PointStatus = 'active' | 'paused' | 'archived';
/** `note` is the only kind used today. `qa` is reserved for question-and-answer points. */
export type PointKind = 'note' | 'qa';

export type Frequency =
  | { mode: 'default' }
  | { mode: 'interval'; everyMinutes: number }
  | { mode: 'per_day'; timesPerDay: number };

export interface Point {
  id: string;
  kind: PointKind;
  /** Line shown in the reminder (the question, for a future `qa` point). */
  prompt: string;
  /** Empty for notes; the revealed answer for a future `qa` point. */
  answer: string | null;
  detail: string | null;
  language: Language;
  category: Category;
  tags: string[];
  status: PointStatus;
  frequency: Frequency;
  nextDueAt: string; // ISO 8601
  speak: boolean;
  /** Overrides Settings.notificationStyle when set. */
  notificationStyle: NotificationStyle | null;
  private: boolean;
  createdAt: string;
  updatedAt: string;
  lastShownAt: string | null;
  timesShown: number;
  timesRemembered: number;
}

/** `grouped`: one notification per slot that opens Review now. `individual`: one notification per point. */
export type NotificationStyle = 'grouped' | 'individual';

export type ReviewAnswer = 'remembered' | 'again_soon' | 'dismissed';

export interface ReviewLogEntry {
  pointId: string;
  shownAt: string;
  answer: ReviewAnswer;
}

export interface TimeRange {
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

/** `hours`: remind inside active hours while awake. `button_only`: remind whenever awake (quiet hours still apply). */
export type ActiveMode = 'hours' | 'button_only';

export interface Settings {
  defaultFrequency: Exclude<Frequency, { mode: 'default' }>;
  /** Reminders run from `start` up to, but not including, `end`. May cross midnight. */
  activeHours: TimeRange;
  activeMode: ActiveMode;
  /** The Awake/Sleep button. When false nothing is scheduled. */
  awake: boolean;
  quietHours: TimeRange[];
  appLanguage: Language;
  speechRate: number;
  delivery: { notification: boolean; widget: boolean; voice: boolean };
  appLock: { enabled: boolean; timeoutSeconds: number };
  /** Default is `grouped`. */
  notificationStyle: NotificationStyle;
  privateNotifications: boolean;
}
