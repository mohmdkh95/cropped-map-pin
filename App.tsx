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
 * Two ways to swap the artwork:
 *
 *   ZOOM   - zoomed out uses the vector, zoomed in uses the raster, mirroring
 *            the app this came from. This does NOT reproduce the defect: the
 *            camera change refreshes the markers, which clears the stale bitmap.
 *   BUTTON - flips the artwork with the map untouched. This is the reproduction.
 *
 * The difference between the two is the point. The bug needs the artwork to
 * change while the map itself is still.
 */
import React, {useEffect, useRef, useState} from 'react';
import {Platform, Pressable, StyleSheet, Text, View} from 'react-native';
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import Pin from './src/Pin';

const BASE = {latitude: 48.2, longitude: 11.0};
const at = (i: number) => ({
  latitude: BASE.latitude,
  longitude: BASE.longitude + i * 1.15,
});

// Mirrors the production threshold: one artwork close in, another far out.
const ZOOM_THRESHOLD = 2.0;

const CASES = [
  '1  swap, no key            -> CROPPED',
  '2  swap, marker keyed      -> ok',
  '3  vector from mount       -> ok',
  '4  swap + redraw()         -> CROPPED',
  '5  swap + 1dp wrapper nudge-> ok',
];

export default function App() {
  const [delta, setDelta] = useState(6);
  const [nudge, setNudge] = useState(0);
  const redrawRef = useRef<React.ElementRef<typeof Marker> | null>(null);

  // The artwork is a pure function of zoom, exactly as in the real app. The
  // marker's own size is identical either way, which is what hides the change.
  // null = follow the zoom threshold; true/false = pinned by the button
  const [pinned, setPinned] = useState<boolean | null>(null);
  const byZoom = delta >= ZOOM_THRESHOLD;
  const vector = pinned ?? byZoom;

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
        toolbarEnabled={false}
        onRegionChangeComplete={r => setDelta(r.latitudeDelta)}>
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

      <Pressable
        style={styles.button}
        onPress={() => setPinned(p => !(p ?? byZoom))}>
        <Text style={styles.buttonText}>
          swap artwork without touching the map
        </Text>
      </Pressable>

      {/* the same swap outside the map: proves the artwork itself is fine */}
      <View style={styles.reference} pointerEvents="none">
        <Text style={styles.small}>outside the map</Text>
        <Pin vector={vector} />
      </View>

      <View style={styles.legend} pointerEvents="none">
        <Text style={styles.small}>
          {`zoom delta ${delta.toFixed(2)} ${
            vector ? '>=' : '<'
          } ${ZOOM_THRESHOLD} -> ${vector ? 'VECTOR' : 'raster'}`}
        </Text>
        <Text style={styles.small}>
          {pinned === null ? 'driver: zoom' : 'driver: button (map untouched)'}
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
  button: {
    position: 'absolute',
    top: 48,
    right: 16,
    backgroundColor: '#222',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    maxWidth: 150,
  },
  buttonText: {color: '#fff', fontSize: 11, textAlign: 'center'},
  small: {
    fontSize: 11,
    color: '#111',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 3,
    marginTop: 1,
  },
});
