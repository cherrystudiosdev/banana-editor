# ADR 0003: One native composition path for preview and export

Status: accepted with a documented performance cost. Date: 2026-10-28.

Program preview renders the complete sequence into a local cache using the same
FFmpeg composition pipeline as final export. It includes all active visual layers,
titles/captions, gaps, transitions, effects and audio mix. An HTML media element
provides one playback clock and seek resynchronization.

Text layout and raster assets are shared by both outputs. This avoids presenting
source-only playback as the final timeline and reduces disagreements between
preview/export. Edits invalidate the cache; the next preview must rebuild it.

Consequences: long sequences require rendering before playback and consume cache
space. This implementation does not claim realtime WebGL composition. Performance
improvements must preserve the same evaluator and validated render semantics.
