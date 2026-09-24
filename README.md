# react-native-maps — a marker reuses its bitmap, so swapped artwork is clipped

Android. All five markers below were handed the **same** 50x54 teardrop. Two came back
without their tail.

![five pins on a live map, two clipped](docs/pins-live.jpg)

| | |
|---|---|
| react-native | 0.81.4 |
| react-native-maps | 1.26.18 |
| react-native-svg | 15.14.0 |
| reproduced on | Pixel 6a emulator, API 36, density 2.625 |

## What you are looking at

**Why a marker can go wrong at all.** On Android, Google Maps will not host live views inside
a marker. So react-native-maps takes a photograph of whatever you put in the marker and hands
that picture to the map. Everything you see in a custom marker is a bitmap, not the views you
wrote.

**The defect.** The library keeps that bitmap and reuses it. It throws it away and allocates a
new one only when the marker's **size** changes. Nothing else triggers it, not a content
change, not a redraw request.

So if you replace a marker's artwork with different artwork of the same size, the library is
never told anything happened. It paints the new artwork into the buffer it already had, and
what comes out is short.

**Why these two pins and not the others.** All five swap a grey image for an orange vector at
the same moment, raster first then vector, the same order and direction the production app
hits when a blocked car is zoomed out past its price threshold. What differs is what happens
to the marker around them.

| pin | what happens to the marker | outcome |
|---|---|---|
| 1 | nothing, it survives the swap | buffer reused, **clipped** |
| 2 | React rebuilds it, because it is keyed on the artwork | new marker, new buffer |
| 3 | never swaps at all | nothing to go stale |
| 4 | survives, and `redraw()` is called | redraw uses the same buffer, **still clipped** |
| 5 | survives, but the wrapper grows by one point | size changed, so new buffer |

Pins 4 and 5 are the pair that makes this a report rather than a guess. Asking the marker to
redraw itself changes nothing. Nudging its size by a single point fixes it. The only
difference between those two actions is whether a fresh bitmap gets allocated, which is what
pins the blame on the buffer rather than on layout or on the change tracker.

**The damage is permanent until the marker is rebuilt.** Swapping back to the original
artwork does not repair it. Once a marker's buffer is bad, everything drawn into it afterwards
is clipped the same way, which is why only a fresh mount is ever clean.

**What makes it reachable in ordinary code.** The library watches only the marker's first
child for size changes. The pin here is a grandchild, sitting inside a wrapper that reserves
space above it for a badge. Wrappers like that are completely normal. Take the wrapper away
and the bug vanishes, because the pin becomes the first child and gets watched.

**One distinction about what you run.** The static screen is a reconstruction: it clips those
two pins deliberately, to the geometry measured on a real device. The live screen is the
actual reproduction. The defect only exists inside a real marker, so a screen without a map
can show you the result but cannot produce it.

## Where it happens in the library

A marker cannot host live views on Android, so the library photographs its children into a
bitmap. It keeps that bitmap and reuses it, discarding it only when the marker's **size**
changes:

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

So if you replace a marker's artwork with something the same size, nothing re-measures, the
bitmap is reused, and the new artwork is drawn short.

## Two screens

| file | map | shows |
|---|---|---|
| `src/StaticDemo.tsx` | a static image | the recorded result, no key needed, **the default** |
| `src/LiveMapRepro.tsx` | real Google map | the defect happening live, needs a key |

`App.tsx` renders the static one, so the project runs from a clean clone with nothing
configured. Swap its single import for `LiveMapRepro` when you have a key.

The static screen is a **reconstruction**. It clips the two broken pins to the geometry
measured on device, dropping the bottom 15dp. It cannot reproduce the defect, because the
defect lives in the marker's bitmap handling and only exists inside a real `<Marker>`.

![close-up of the static screen pins](docs/pins-static.png)

## Run it

```bash
npm install
npx react-native run-android
```

That is the whole setup for the static screen.

For the live one, supply a key:

```
# ~/.gradle/gradle.properties
MAPS_API_KEY=AIza...
```

**The key's project must have "Maps SDK for Android" enabled, and the key must be allowed to
call it.** A Maps Platform key provisioned for the web products will not do: Maps JavaScript
API is a different product and does not cover native Android. Check both in Cloud Console:

1. **APIs & Services → Library**, search *Maps SDK for Android*, Enable it on the project.
2. On the key, under **API restrictions**, tick *Maps SDK for Android*, or choose *Don't
   restrict key*.

Application restrictions are a separate setting and are usually not the problem. If the key
does restrict by Android app, add package `com.markerbitmaprepro` with the debug SHA-1
`5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`, which is the standard debug
certificate in `android/app/debug.keystore`.

Without any key the SDK throws `IllegalStateException: API key not found` and the process
dies. With a key it does not accept, the map fails authorization and draws nothing at all,
markers included.

![the live map screen](docs/live-map.jpg)

## Steps to reproduce

1. `npm install`
2. Put a Maps key with **Maps SDK for Android** enabled in `~/.gradle/gradle.properties` as
   `MAPS_API_KEY=...`
3. In `App.tsx`, import `./src/LiveMapRepro` instead of `./src/StaticDemo`
4. `npx react-native run-android`
5. Wait for the pins. They mount as the **raster** artwork, grey, matching a blocked car in
   the app this came from. Pin 3 is hardcoded to the vector and is the only coloured one.
6. Tap **swap artwork without touching the map**, top right. Every pin switches to the vector
   artwork, which is the same size. **This is the tap that shows the defect.**
7. Keep tapping to swap back and forth.

**Expected:** all five pins render the full teardrop, ring and tail, every time.

**Actual:** after step 6, pins 1 and 4 have lost their tail and part of the ring. Pins 2, 3
and 5 are correct. The same two break on every return to the vector.

**The damage does not heal.** Swapping back to the raster artwork does not repair those two
pins; they stay clipped in that state too. Only the very first mount is clean:

| state | pins 1 and 4 |
|---|---|
| mount | intact |
| tap 1, vector | clipped |
| tap 2, raster | **still clipped** |
| tap 3, vector | clipped |
| tap 4, raster | **still clipped** |

That is the clearest sign the artwork is not what is broken. The clipping belongs to the
marker's buffer, so everything drawn into it afterwards inherits it, image or vector alike. A
marker that takes the damage keeps it for its whole lifetime, and only a rebuild clears it,
which is exactly why pins 2 and 5 never show it.

Do not use zoom to trigger the swap. A camera change refreshes the markers and hides the
defect; see [Zoom hides it](#zoom-hides-it).

### Smallest form

Strip away the five variants and this is all it takes. One marker, one wrapper whose size
never changes, and a child swapped underneath it:

```tsx
const [vector, setVector] = useState(false);

<Marker coordinate={c} anchor={{x: 0.5, y: 1}}>
  {/* 50x69 in both states, so the library is never told anything changed */}
  <View style={{width: 50, height: 69}}>
    {vector ? (
      <Svg width={50} height={54} viewBox="0 0 150 151"
           preserveAspectRatio="xMidYMid slice"
           style={{position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
                   marginTop: 15}}>
        {/* ring + tail */}
      </Svg>
    ) : (
      <Image source={png}
             style={{position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
                     width: 50, height: 54, marginTop: 15}} />
    )}
  </View>
</Marker>
```

Call `setVector(true)` after the marker has mounted and the vector draws clipped. Two details
matter: the wrapper's size is identical in both states, and the swapped child is a grandchild
of the `<Marker>` rather than its first child.


## The measurements

A sixth copy renders outside the map and stays correct throughout, which shows the artwork
itself is fine.

Measured ink height in screen pixels:

| pin | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| width | 112 | 113 | 113 | 113 | 112 |
| height | **94** | 131 | 131 | **94** | 131 |

Identical width in all five, so only the vertical is wrong. The 37px shortfall is about 14dp
at this density, which is the wrapper's 15dp top margin. The same numbers appear in the
production app this was extracted from, 95 against 133.

### What the layout engine reports

Logged with `onLayout` on device, in density-independent points:

| | frame | position |
|---|---|---|
| wrapper, **the marker's first child** | 50 x 69 | (0, 0) |
| raster `<Image>` | 50 x 54 | (0, 15) |
| vector `<Svg>` | 41 x 50 | (4, 4) |

**The wrapper is identical in both states.** That is the fact the bug rests on. It is a plain
`View`, it is the child at index 0, it is the only thing the library watches, and it never
moves. A constant wrapper over changing content is all it takes.

**Do not read the `<Svg>` row as the artwork's frame.** It reports a box 9 points narrower,
4 shorter and 11 higher than the image, but on screen the two artworks paint in exactly the
same place at the same size, measured at the same pixel row to within a pixel. `onLayout` on
an `<Svg>` lands on something other than the painted box, and what that 41 x 50 describes is
unclear. It is recorded here only so nobody repeats the measurement and draws a conclusion
from it.

## Zoom hides it

In the live screen there are two ways to swap the artwork, and only one reproduces the defect.

| driver | what it does | result |
|---|---|---|
| zoom | raster when zoomed in, vector when zoomed out, mirroring the app this came from | **does not reproduce** |
| button | flips the artwork with the map untouched | **reproduces every time** |

The zoom threshold is relative rather than a fixed number: it is one and a half times
whatever region the map settles on, captured from the first `onRegionChangeComplete`. Google
fits `initialRegion` to the viewport, so the settled delta varies by device, and a hardcoded
threshold tuned on one screen puts the mount state on the wrong side of the line on another.

A camera change refreshes the markers, which discards the stale bitmap as a side effect, so
the bug hides whenever the swap rides along with a zoom. It needs the artwork to change while
the map is still. Measured over three zoom cycles, every pin stayed at 131px. In the original
app the same thing showed up as the defect sparing any car that had just been re-clustered.

## Why the structure matters

`src/Pin.tsx` mirrors a production marker on purpose:

```
wrapper View  50x69   <- the marker's child at index 0; identical in both states
  pin (absolute)      <- swaps between <Image> and <Svg>, both painting the
                         same 50x54 box; a GRANDCHILD, so nothing watches it
  overlay (in flow)
```

Put the pin directly under the `<Marker>` with no wrapper and the bug disappears: the pin is
then index 0 itself, gets a layout listener, and the bitmap is discarded. The wrapper is what
hides the change, and wrappers are ordinary — ours exists to reserve space above the pin for
a badge.

## What a fix would look like

The drawable cache is keyed on dimensions alone, so any content change that preserves the
marker's size reuses a bitmap it should not. Either invalidate the cache when the subtree
changes rather than only when the bounds do, or attach the layout listener to the whole
subtree instead of only the child at index 0.

## Workaround

Give the `<Marker>` a key derived from whatever selects the artwork, so React unmounts and
remounts it. That is pin 2. Neither `tracksViewChanges` nor `redraw()` is sufficient.
