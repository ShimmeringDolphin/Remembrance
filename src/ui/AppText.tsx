// Text and TextInput that draw in the app's fonts (see `theme/fonts.ts`). Until the fonts have loaded, or if they
// fail to, the phone's own font is used, so text is never missing. No timers, no network: the fonts are bundled files.
import { createContext, useContext } from 'react';
import { StyleSheet, Text as NativeText, TextInput as NativeTextInput, type TextInputProps, type TextProps } from 'react-native';

import type { Language } from '../core/types';
import { familyFor } from '../theme/fonts';

export const FontContext = createContext<{ language: Language; ready: boolean }>({ language: 'en', ready: false });

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
