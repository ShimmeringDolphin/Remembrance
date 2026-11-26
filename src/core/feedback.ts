// The feedback email: a mailto link with a short template. It carries the app version, Android version and
// language only; never a point, never anything typed in the app. The user reads and sends it themselves.
export interface FeedbackInfo {
  version: string;
  platform: string;
  osVersion: string;
  language: string;
}

export function feedbackMailto(address: string, info: FeedbackInfo): string {
  const subject = `YaadOM feedback (v${info.version})`;
  const body = ['What worked, and what did not?', '', '', '---', `App version: ${info.version}`, `${info.platform}: ${info.osVersion}`, `Language: ${info.language}`, '(Please do not paste your points here.)'].join('\n');
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
