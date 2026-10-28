# Media and composition engine

`src/main/media/service.ts` is the local media service. It has no Electron or UI
dependency. FFmpeg/ffprobe are invoked with `shell: false`, separate arguments,
hidden windows, bounded stdout and a two-job FIFO queue. Input protocol access is
limited to local files and pipes. Source bytes are never changed.

## Runtime

Run `pnpm setup:ffmpeg` on Windows x64. The pinned BtbN download is verified against
SHA-256 `f70e43c4f5670fbbf2dc4eb667b0d6b3743d68386f766c08bb2e0ec3edece398` before
extraction. Runtime binaries live in `resources/ffmpeg/bin`; the full directory,
including DLLs, licenses and sources, must accompany the app. This runtime requires
Windows 10 22H2 or newer. Read `resources/ffmpeg/SOURCE-PROVISION.md` for the
remaining public redistribution gate concerning third-party dependency sources.

This actual LGPLv3 build supplies CPU `libopenh264` + AAC for MP4 and `libvpx-vp9`
+ `libopus` for WebM. Capability discovery checks encoder names and runs a real
small H.264 encode before offering MP4. Hardware API names are reported separately;
their presence is not a claim that a usable GPU exists. CPU rendering is always
available for the distributed WebM codecs.

## Timeline semantics

The renderer validates the same `Project` schema and invariants as the editor core.
Tracks are composed bottom to top. Same-track clips are ordered by start frame;
their overlaps must satisfy the explicit incoming cross-dissolve model. Incoming
video alpha rises linearly over the overlap while the outgoing image remains
opaque. Audio fades both sides. Base gaps are black and missing audio is silence.

Keyframe expressions mirror `evaluateEffects`: clamp before/after endpoint keys,
linear or left-key hold interpolation, then clip fades and transition factors.
Position is the clip center offset in sequence pixels; crop values are fractions.
Scale 1 fits or fills the sequence according to clip settings. Output size maps
position proportionally. Saturation uses Rec.709 luma weights; contrast operates
around RGB value 128, followed by brightness as an offset of 255 times its value.
All channels clamp to 0–255. Color adjustment, rotation, alpha and audio gain are
applied in the filter graph. Source in-points remain seconds, independent of the
integer sequence frame positions and rational frame rate.

Text uses the bundled Noto Sans Regular font, rendered by Sharp/Pango into transparent
PNG layers at sequence resolution. Pango markup is escaped. Text has a 10% safe
margin and wraps to 80% width. Captions align to the bottom safe area. Text that
cannot fit is rejected with a corrective error. Program preview and export use the
same PNG assets and composition graph, including Turkish glyphs and line breaks.

## Cached playback and export

The program monitor receives a complete rendered timeline cache at its requested
preview resolution. It therefore includes every active layer and audio track. The
video element serves as the central playback clock; any edit invalidates the cache.
Long sequences require render time before playback; this is an explicit performance
limitation of this implementation, not source-only playback represented as editing.

Final exports are written to a unique temporary file in the chosen destination
folder. FFmpeg progress is measured from `out_time_us`. The output is probed for
size and duration before commit. Without overwrite permission, committing uses an
atomic no-clobber hard link; confirmed overwrites use rename. Cancellation or failure
removes temporary outputs and leaves previous destination/source bytes intact.

## Media preparation

Probe checks actual stream/container metadata for MP4/MOV/WebM, WAV/MP3, PNG/JPEG.
Thumbnails and compatible WebM proxies are cached by source path, byte size and
modification time. Audio waveforms contain measured peak levels in at most about
1,200 bins; media is never loaded in full into renderer memory.

AI preparation is explicitly invoked only after user confirmation in the calling
layer. It extracts selected source ranges, at most eight still images and 30-second
mono PCM audio chunks, capped at 64 chunks and 32 MB. Each chunk preserves the
original source offset. No complete video is uploaded by default. Local silence
analysis uses FFmpeg `silencedetect` at -35 dB for intervals of at least 300 ms.

## Validation

`pnpm test:media` generates deterministic color, image and sine-wave fixtures with
the real bundled Windows binaries. Tests inspect output pixels, actual stream FPS
and duration, and decoded audio RMS. They cover multi-track layers, dissolve,
Turkish text, captions, gaps, volume and opacity automation, muted tracks, rational
30000/1001 timing, overwrite protection, corrupt media, cancellation, actual Windows
exclusive-file permission failure, keyframed position/scale, crop/rotation/color,
proxy decoding, track solo, optional captions, 96 kHz mixing resampled to Opus's
48 kHz output, and bounded AI extraction. Test-generated media is not a live AI
response or an application demo.

`node scripts/audit-ffmpeg-sources.mjs` writes a machine-readable source inventory
and exits unsuccessfully while the public redistribution review is incomplete.
`--inventory-only` requests an informational run, never a release pass. `--acquire`
mirrors immutable source archives and extracts their license texts without executing
downloaded code. `--match=PATTERN` and `--limit=N` bound acquisition. Current inventory
contains candidate recipes; presence of a source archive alone is not proof of a
complete corresponding-source package, especially for submodules and Rust crates.
