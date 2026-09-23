/**
 * react-native-maps — Android marker bitmap reuse
 *
 * A marker keeps one bitmap and only discards it when its SIZE changes. Swapping
 * a marker's artwork for something the same size therefore draws the new artwork
 * into a stale buffer, and it comes out clipped.
 *
 * The map starts on a fixed region but pan and zoom are enabled, so the clipped
 * pins can be inspected close up. Every pin is the same 50x54 teardrop, so any
 * difference between them is the marker layer, not the artwork.
 *
 * At t=3s, and every 6s after, the artwork flips between raster and vector.
 * Watch the row: some pins keep their tail, some lose it.
 */
import React, {useEffect, useRef, useState} from 'react';
import {Platform, StyleSheet, Text, View} from 'react-native';
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import Pin from './src/Pin';

const BASE = {latitude: 48.2, longitude: 11.0};
const at = (i: number) => ({
  latitude: BASE.latitude,
  longitude: BASE.longitude + i * 1.15,
});

const CASES = [
  '1  swap, no key            -> CROPPED',
  '2  swap, marker keyed      -> ok',
  '3  vector from mount       -> ok',
  '4  swap + redraw()         -> CROPPED',
  '5  swap + 1dp wrapper nudge-> ok',
];

export default function App() {
  const [vector, setVector] = useState(false);
  const [nudge, setNudge] = useState(0);
  const redrawRef = useRef<React.ElementRef<typeof Marker> | null>(null);

  useEffect(() => {
    const first = setTimeout(() => setVector(true), 3000);
    const loop = setInterval(() => setVector(v => !v), 6000);
    return () => {
      clearTimeout(first);
      clearInterval(loop);
    };
  }, []);

  // case d: ask the marker to re-snapshot once the swap has committed
  useEffect(() => {
    if (!vector) {
      return;
    }
    const t = setTimeout(() => redrawRef.current?.redraw?.(), 120);
    return () => clearTimeout(t);
  }, [vector]);

  // case e: grow the wrapper by one point, the only thing that re-measures
  useEffect(() => {
    setNudge(0);
    const t = setTimeout(() => setNudge(1), 400);
    return () => clearTimeout(t);
  }, [vector]);

  return (
    <View style={styles.root}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={{...BASE, latitudeDelta: 6, longitudeDelta: 8}}
        scrollEnabled
        zoomEnabled
        zoomControlEnabled
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}>
        {/* a - the bug: same marker, artwork replaced underneath it */}
        <Marker coordinate={at(-2)} anchor={{x: 0.5, y: 1}}>
          <Pin vector={vector} />
        </Marker>

        {/* b - the fix: keyed on the artwork, so React rebuilds the marker */}
        <Marker key={`pin-${vector}`} coordinate={at(-1)} anchor={{x: 0.5, y: 1}}>
          <Pin vector={vector} />
        </Marker>

        {/* c - control: never swaps, so nothing can go stale */}
        <Marker coordinate={at(0)} anchor={{x: 0.5, y: 1}}>
          <Pin vector />
        </Marker>

        {/* d - redraw() re-runs the snapshot but keeps the same bitmap */}
        <Marker ref={redrawRef} coordinate={at(1)} anchor={{x: 0.5, y: 1}}>
          <Pin vector={vector} />
        </Marker>

        {/* e - a 1dp size change forces a new bitmap, without remounting */}
        <Marker coordinate={at(2)} anchor={{x: 0.5, y: 1}}>
          <Pin vector={vector} nudge={nudge} />
        </Marker>
      </MapView>

      {/* the same swap outside the map: proves the artwork itself is fine */}
      <View style={styles.reference} pointerEvents="none">
        <Text style={styles.small}>outside the map</Text>
        <Pin vector={vector} />
      </View>

      <View style={styles.legend} pointerEvents="none">
        <Text style={styles.small}>
          {vector ? 'vector' : 'raster'} — left to right:
        </Text>
        {CASES.map(c => (
          <Text key={c} style={styles.small}>
            {c}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  reference: {position: 'absolute', top: 48, left: 16, alignItems: 'center'},
  legend: {position: 'absolute', bottom: 28, left: 16},
  small: {
    fontSize: 11,
    color: '#111',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 3,
    marginTop: 1,
  },
});
