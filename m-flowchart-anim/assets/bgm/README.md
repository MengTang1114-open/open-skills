# BGM presets

`presets.json` describes each track: its beat period, first beat, and loop method.
- `seamless: true`: the file is a seamless loop and is simply repeated end to end.
- otherwise: the track is looped on the beat-aligned `loop_in`/`loop_out` points, with a short crossfade at the seam.

`build.py` uses this data to snap the animation to the beat, and `record.py` uses it to loop the track.

All bundled tracks are CC0 (public domain): free for commercial use and redistribution, no credit required. Sources are in `CREDITS.md`.

To add a track: put the file here and add an entry to `presets.json`.
Measure `period` and `first_beat` from the kick drum: take librosa onset strength on a low band (mel, fmax≈200 Hz) and pick the period and phase whose grid hits the strongest onsets. Check that the best phase stays put across 10 s windows; if it drifts, the period is off. `beat_track` alone can lock onto off-beats or 1.5× the tempo.
Choose `loop_in` and `loop_out` as `first_beat` plus a whole number of bars.
You can also pass any audio file with `--bgm path/to/track.mp3`: it is simply trimmed to the video length, with no beat snapping.
