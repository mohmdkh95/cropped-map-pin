# react-native-maps — a marker reuses its bitmap, so swapped artwork is clipped

Minimal reproduction. Android. The map is deliberately static: fixed region, gestures
disabled, so nothing here depends on panning or timing.

| | |
|---|---|
| react-native | 0.81.4 |
| react-native-maps | 1.26.18 |
| react-native-svg | 15.14.0 |
| reproduced on | Pixel 6a emulator, API 36, density 2.625 |

## The defect

A marker cannot host live views on Android, so the library photographs its children into
a bitmap. It keeps that bitmap and reuses it, discarding it only when the marker's
**size** changes:

```java
// MapMarker.createDrawable()
Bitmap bitmap = mLastBitmapCreated;
if (bitmap == null || bitmap.isRecycled()
    || bitmap.getWidth() != width || bitmap.getHeight() != height) {
    bitmap = Bitmap.createBitmap(width, height, ARGB_8888);   // fresh
    mLastBitmapCreated = bitmap;
} else {
    bitmap.eraseColor(Color.TRANSPARENT);                      // reused
}
this.draw(new Canvas(bitmap));
```

`mLastBitmapCreated` is cleared in one place only, `clearDrawableCache()`, reached from
`update(int width, int height)` — which runs from a layout listener that
`MarkerManager.addView` attaches to **the child at index 0**.

So if you replace a marker's artwork with something the same size, nothing re-measures,
the bitmap is reused, and the new artwork is drawn short.

## What you should see

Five pins in a row. All five are the same 50x54 teardrop. Every 6 seconds the artwork
flips between a raster PNG and an SVG.

| pin | what it does | expected |
|---|---|---|
| 1 | artwork swapped in place | **clipped, loses its tail** |
| 2 | marker keyed on the artwork, so React rebuilds it | correct |
| 3 | vector from mount, never swaps | correct |
| 4 | swapped, then `marker.redraw()` | **still clipped** |
| 5 | swapped, then the wrapper grows by 1dp | correct |

A sixth copy renders outside the map and stays correct throughout, which shows the
artwork itself is fine.

Pins 4 and 5 are the interesting pair. `redraw()` re-runs the snapshot into the same
buffer and does not help. A one-point size change forces a new buffer and does. That is
what identifies the bitmap, rather than layout or the change tracker, as the stale thing.

Measured in the app this was extracted from: the clipped pin renders 95px of ink against
133px for an identical pin built fresh, at equal width. Only the vertical is wrong, and
the shortfall matches the wrapper's 15dp top margin.

## Why the structure matters

`src/Pin.tsx` mirrors a production marker on purpose:

```
wrapper View          <- the marker's child at index 0; its size never changes
  pin (absolute)      <- swaps between <Image> and <Svg>; a GRANDCHILD of the marker
  overlay (in flow)
```

Put the pin directly under the `<Marker>` with no wrapper and the bug disappears: the pin
is then index 0 itself, gets a layout listener, and the bitmap is discarded. The wrapper
is what hides the change, and wrappers are ordinary — ours exists to reserve space above
the pin for a badge.

## Run it

A Google Maps API key is **required**. Without one the app does not degrade, it crashes:

```
java.lang.IllegalStateException: API key not found.
```

Put the key somewhere outside the repo. Either in your user-global Gradle properties:

```
# ~/.gradle/gradle.properties
MAPS_API_KEY=AIza...
```

or pass it per build:

```bash
npm install
npx react-native run-android -- --extra-params "-PMAPS_API_KEY=AIza..."
```

The build reads it through `project.findProperty('MAPS_API_KEY')` and injects it as a
manifest placeholder, so no key is ever committed.

## What a fix would look like

The drawable cache is keyed on dimensions alone, so any content change that preserves the
marker's size reuses a bitmap it should not. Either invalidate the cache when the subtree
changes rather than only when the bounds do, or attach the layout listener to the whole
subtree instead of only the child at index 0.

## Workaround

Give the `<Marker>` a key derived from whatever selects the artwork, so React unmounts and
remounts it. That is pin 2. Neither `tracksViewChanges` nor `redraw()` is sufficient.
