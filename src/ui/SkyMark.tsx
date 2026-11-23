// The Sky symbol: a bright five-point star in front, a dimmer four-point star behind it, and a dimmest
// three-point star furthest back. Still, never animated: it costs nothing to draw and nothing to keep.
import Svg, { Path } from 'react-native-svg';

import { SKY_MARK } from '../theme/calmStudy';

const FIVE = 'M30,0 Q36.89,20.51 58.53,20.73 Q41.16,33.62 47.63,54.27 Q30,41.73 12.37,54.27 Q18.84,33.62 1.47,20.73 Q23.11,20.51 30,0Z';
const FOUR = 'M70,53 Q72.05,65.95 85,68 Q72.05,70.05 70,83 Q67.95,70.05 55,68 Q67.95,65.95 70,53Z';
const THREE = 'M36,84.5 Q37.43,91.17 42.5,95.75 Q36,93.65 29.5,95.75 Q34.57,91.17 36,84.5Z';

export function SkyMark(props: { size: number }) {
  return (
    <Svg width={props.size} height={props.size} viewBox="-3 -3 92 102" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={THREE} fill={SKY_MARK.three} stroke={SKY_MARK.three} strokeWidth={3} strokeLinejoin="round" />
      <Path d={FOUR} fill={SKY_MARK.four} stroke={SKY_MARK.four} strokeWidth={3} strokeLinejoin="round" />
      <Path d={FIVE} fill="none" stroke={SKY_MARK.five} strokeWidth={8} strokeLinejoin="round" opacity={0.22} />
      <Path d={FIVE} fill={SKY_MARK.five} stroke={SKY_MARK.five} strokeWidth={3} strokeLinejoin="round" />
    </Svg>
  );
}
