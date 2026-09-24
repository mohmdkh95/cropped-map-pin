/**
 * Default entry: the static, key-free screen.
 *
 * To run the LIVE reproduction against a real map you need a Google Maps key
 * whose project has "Maps SDK for Android" enabled (see README), then swap the
 * import below for:
 *
 *   import LiveMapRepro from './src/LiveMapRepro';
 */
import React from 'react';
import StaticDemo from './src/StaticDemo';

export default function App() {
  return <StaticDemo />;
}
