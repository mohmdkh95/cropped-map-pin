import React from 'react';
import {Image, StyleSheet, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';

/**
 * Deliberately mirrors the production marker's structure, because the structure
 * is what makes the bug reachable:
 *
 *   wrapper View            <- the marker's child at index 0; its size never changes
 *     pin  (absolute)       <- swaps between <Image> and <Svg>; a GRANDCHILD of the marker
 *     overlay (in flow)
 *
 * The wrapper is sized from props that are identical for both artworks, so the
 * library is never told anything changed.
 */

export const PIN_W = 50;
export const PIN_H = 54;
export const TOP_MARGIN = 15; // room reserved above the pin, as in production

const ORANGE = '#ff7e21';

const Vector = ({color}: {color: string}) => (
  <Svg
    width={PIN_W}
    height={PIN_H}
    viewBox="0 0 150 151"
    preserveAspectRatio="xMidYMid slice"
    style={[styles.pin, {marginTop: TOP_MARGIN}]}>
    <Path
      d="M75 12C106.48 12 132 37.5198 132 69C132 100.48 106.48 126 75 126C43.5198 126 18 100.48 18 69C18 37.5198 43.5198 12 75 12Z"
      fill="white"
      stroke={color}
      strokeWidth="6"
    />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M90.9063 125.812L74.7439 150.181L58.5815 125.812L90.9063 125.812Z"
      fill={color}
    />
  </Svg>
);

const Raster = () => (
  <Image
    source={require('../assets/pin-raster.png')}
    style={[
      styles.pin,
      {width: PIN_W, height: PIN_H, marginTop: TOP_MARGIN},
    ]}
  />
);

type Props = {
  /** false = raster artwork, true = vector artwork */
  vector: boolean;
  /** grows the wrapper by 1dp; the only thing that makes the library re-measure */
  nudge?: number;
};

const Pin = ({vector, nudge = 0}: Props) => (
  <View
    style={[
      styles.wrapper,
      {width: PIN_W, height: PIN_H + TOP_MARGIN + nudge},
    ]}>
    {vector ? <Vector color={ORANGE} /> : <Raster />}
    <View style={styles.overlay} />
  </View>
);

const styles = StyleSheet.create({
  wrapper: {justifyContent: 'center', alignItems: 'center'},
  pin: {position: 'absolute', top: 0, bottom: 0, left: 0, right: 0},
  overlay: {marginTop: 10, width: 26, height: 8, backgroundColor: '#444'},
});

export default Pin;
