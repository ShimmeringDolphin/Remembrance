// Which of the phone's voices to read with. A voice that needs the internet (Google's "-network" voices) is slow
// to start each time the language changes, so offline voices come first, then Indian ones, then the rest.
export interface VoiceInfo {
  identifier: string;
  name: string;
  language: string;
}

/** The identifier of the best voice for a bare language code ("en", "hi", "gu"), or undefined if there is none. */
export function pickVoice(voices: readonly VoiceInfo[], code: string): string | undefined {
  const lang = (v: VoiceInfo) => v.language.toLowerCase().replace('_', '-');
  const network = (v: VoiceInfo) => /network/i.test(v.identifier) || /network/i.test(v.name);
  const score = (v: VoiceInfo) => (network(v) ? 0 : 4) + (lang(v).endsWith('-in') ? 2 : 0) + (/local/i.test(v.identifier) ? 1 : 0);
  let best: VoiceInfo | undefined;
  for (const v of voices) {
    if (!lang(v).startsWith(code)) continue;
    if (!best || score(v) > score(best)) best = v;
  }
  return best?.identifier;
}
