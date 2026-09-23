/**
 * Default entry: the static, key-free screen.
 *
 * To run the LIVE reproduction against a real map, supply a Google Maps key
 * (see README) and swap the import below for:
 *
 *   import LiveMapRepro from './src/LiveMapRepro';
 */
import React from 'react';
import StaticDemo from './src/StaticDemo';

export default function App() {
  return <StaticDemo />;
}
