/**
 * Static, key-free screen. Shows what the five markers looked like on device,
 * over a static map background instead of a live map.
 *
 * This is a RECONSTRUCTION, not a live reproduction. The defect lives in the
 * marker's bitmap handling, so it can only happen inside a real <Marker>, which
 * needs Google Maps and an API key. Here the two broken pins are clipped
 * explicitly, to the geometry measured on device: the bottom 15dp is removed,
 * which is exactly the wrapper's top margin.
 *
 * Run src/LiveMapRepro.tsx instead when you have a key.
 */
import React from 'react';
import {Image, ScrollView, StyleSheet, Text, View} from 'react-native';
import Pin, {PIN_H, PIN_W, TOP_MARGIN} from './Pin';

type Case = {n: string; label: string; cropped: boolean};

const CASES: Case[] = [
  {n: '1', label: 'swapped in place', cropped: true},
  {n: '2', label: 'marker keyed', cropped: false},
  {n: '3', label: 'vector from mount', cropped: false},
  {n: '4', label: 'swapped + redraw()', cropped: true},
  {n: '5', label: 'swapped + 1dp nudge', cropped: false},
];

/** Clipping to PIN_H drops the bottom TOP_MARGIN, which is what was measured. */
const Slot = ({cropped}: {cropped: boolean}) => (
  <View
    style={[
      styles.slot,
      cropped && {height: PIN_H, overflow: 'hidden'},
    ]}>
    <Pin vector />
  </View>
);

const StaticDemo = () => (
  <View style={styles.root}>
    <Image
      source={require('../assets/static-map.png')}
      style={StyleSheet.absoluteFill}
      resizeMode="cover"
    />

    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Marker bitmap reuse, recorded result</Text>
        <Text style={styles.body}>
          All five markers were given identical 50x54 artwork. Two came back
          short. Measured on a Pixel 6a emulator.
        </Text>
      </View>

      <View style={styles.row}>
        {CASES.map(c => (
          <View key={c.n} style={styles.cell}>
            <Slot cropped={c.cropped} />
            <Text style={[styles.tag, c.cropped && styles.tagBad]}>
              {c.cropped ? 'CROPPED' : 'ok'}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        {CASES.map(c => (
          <Text key={c.n} style={styles.body}>
            {`${c.n}  ${c.label}${c.cropped ? '   <- clipped' : ''}`}
          </Text>
        ))}
        <Text style={styles.measured}>ink height: 94px vs 131px, same width</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.body}>
          This screen is a reconstruction. The defect needs a real marker, so the
          live version needs a Google Maps key. See the README.
        </Text>
      </View>
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  root: {flex: 1},
  content: {padding: 16, paddingTop: 56},
  card: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  title: {fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 6},
  body: {fontSize: 12, color: '#222', lineHeight: 18},
  measured: {fontSize: 12, color: '#222', marginTop: 8, fontWeight: '600'},
  row: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20},
  cell: {alignItems: 'center', width: PIN_W + 8},
  slot: {width: PIN_W, height: PIN_H + TOP_MARGIN, justifyContent: 'flex-start'},
  tag: {fontSize: 9, color: '#0a0', marginTop: 6, fontWeight: '600'},
  tagBad: {color: '#c00'},
});

export default StaticDemo;
