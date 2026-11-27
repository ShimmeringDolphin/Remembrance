// One star, drawn the same everywhere. Filled: it has come back. Hollow: still to come.
import Svg, { Polygon } from 'react-native-svg';

import { starPoints } from '../core/star';

export function Star(props: { radius: number; color: string; outline?: boolean }) {
  const { radius, color, outline } = props;
  const box = radius * 2 + 4;
  return (
    <Svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Polygon
        points={starPoints(box / 2, box / 2, radius)}
        fill={outline ? 'none' : color}
        stroke={color}
        strokeWidth={outline ? 1.5 : 1}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
