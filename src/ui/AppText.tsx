// Text and TextInput that draw in the app's fonts (see `theme/fonts.ts`). Until the fonts have loaded, or if they
// fail to, the phone's own font is used, so text is never missing. No timers, no network: the fonts are bundled files.
import { createContext, useContext } from 'react';
import { StyleSheet, Text as NativeText, TextInput as NativeTextInput, type TextInputProps, type TextProps } from 'react-native';

import type { Language } from '../core/types';
import { familyFor, familyOfSet, fontRuns, setOfLanguage, type FontSet } from '../theme/fonts';

export const FontContext = createContext<{ language: Language; ready: boolean; extra: FontSet[] }>({ language: 'en', ready: false, extra: [] });

export function Text(props: TextProps) {
  const { language, ready } = useContext(FontContext);
  if (!ready) return <NativeText {...props} />;
  const weight = StyleSheet.flatten(props.style)?.fontWeight;
  // The weight is in the font file, so the style's own weight must not be applied on top.
  return <NativeText {...props} style={[props.style, { fontFamily: familyFor(language, weight), fontWeight: 'normal' }]} />;
}

export function TextInput(props: TextInputProps) {
  const { language, ready } = useContext(FontContext);
  if (!ready) return <NativeTextInput {...props} />;
  return <NativeTextInput {...props} style={[props.style, { fontFamily: familyFor(language, undefined) }]} />;
}

/** A point's own words: each part is drawn in a font that has its letters, falling back to the phone's font while that set is not loaded. */
export function PointText(props: TextProps & { children: string }) {
  const { language, ready, extra } = useContext(FontContext);
  if (!ready) return <NativeText {...props} />;
  const weight = StyleSheet.flatten(props.style)?.fontWeight;
  const have = (set: FontSet) => set === setOfLanguage(language) || extra.includes(set);
  const runs = fontRuns(props.children, language);
  if (runs.length === 1 && have(runs[0].set)) {
    return <NativeText {...props} style={[props.style, { fontFamily: familyOfSet(runs[0].set, weight), fontWeight: 'normal' }]} />;
  }
  return (
    <NativeText {...props} style={[props.style, { fontWeight: 'normal' }]}>
      {runs.map((r, i) => (have(r.set) ? <NativeText key={i} style={{ fontFamily: familyOfSet(r.set, weight) }}>{r.text}</NativeText> : r.text))}
    </NativeText>
  );
}
