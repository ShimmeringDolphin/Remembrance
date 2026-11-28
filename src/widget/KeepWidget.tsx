// The "Keep in mind" home-screen widget (Android). It shows the points of the reminder that came
// last, with the same privacy rules as a notification, and opens the app when tapped.
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { tint, type Theme } from '../theme/calmStudy';
import type { Category } from '../core/types';

export const WIDGET_NAME = 'KeepInMind';

type Hex = `#${string}`;

function Card(props: { title: string; lines: string[]; kinds: (Category | null)[]; empty: string; theme: Theme }) {
  const c = props.theme;
  const lines = props.lines.length > 0 ? props.lines : [props.empty];
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel={`${props.title}. ${lines.join('. ')}`}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: c.surface as Hex, borderRadius: 24, padding: 14, flexDirection: 'column' }}
    >
      <TextWidget text={props.title} style={{ fontSize: 13, fontWeight: '700', color: c.muted as Hex, marginBottom: 6 }} />
      {lines.slice(0, 4).map((line, i) => (
        <FlexWidget key={i} style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', marginBottom: 4 }}>
          {props.lines.length > 0 && (
            <FlexWidget style={{ width: 8, height: 8, borderRadius: 4, marginRight: 8, backgroundColor: (props.kinds[i] ? tint(c, props.kinds[i]!) : c.thread) as Hex }} />
          )}
          <TextWidget text={line} maxLines={2} truncate="END" style={{ fontSize: 16, color: (props.lines.length > 0 ? c.text : c.muted) as Hex }} />
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}

export function keepWidget(title: string, lines: string[], kinds: (Category | null)[], empty: string, light: Theme, dark: Theme) {
  return { light: <Card title={title} lines={lines} kinds={kinds} empty={empty} theme={light} />, dark: <Card title={title} lines={lines} kinds={kinds} empty={empty} theme={dark} /> };
}
