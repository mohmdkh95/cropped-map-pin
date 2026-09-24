/**
 * Default entry: the LIVE reproduction against a real map.
 *
 * A demo Google Maps key ships in android/gradle.properties, so this runs from
 * a clean clone with no setup.
 *
 * For the static, map-free screen instead, swap the import below for:
 *
 *   import StaticDemo from './src/StaticDemo';
 */
import React from 'react';
import LiveMapRepro from './src/LiveMapRepro';

export default function App() {
  return <LiveMapRepro />;
}
