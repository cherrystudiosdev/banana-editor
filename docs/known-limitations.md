# Known limitations and open release gates

This file distinguishes intentional product boundaries from unfinished mandatory
verification. Documenting a broken mandatory workflow does not make it acceptable
for stable delivery. The original 1.0.0 scope remains unchanged.

## Design and capability boundaries

- Program preview uses a complete local composition cache. After an edit, the
  cache must render again before playback. Long projects therefore have latency
  and disk requirements beyond a realtime compositor.
- HDR mastering, multicam, object tracking and advanced professional color
  management are outside the stated 1.0.0 scope. Premiere `.prproj` compatibility
  is not implemented or advertised.
- Only the Windows x64 runtime is prepared. The selected FFmpeg build requires
  Windows 10 22H2 or later. No macOS/Linux downloads are verified.
- GPU API discovery is informational. CPU rendering remains the baseline; a
  detected encoder name does not prove hardware availability on the user's PC.
- Text uses bundled Noto Sans. Turkish glyphs use the same rendered assets in
  preview and export. Font-family selection beyond the bundled font requires
  implementation/verification against the original title requirements.
- OpenAI `gpt-transcribe` returns chunk text rather than precise segment/word
  times. Its captions use disclosed extracted-chunk boundaries. Gemini segment
  timing is model-estimated and needs review. Word synchronization is not claimed.
- Custom AI model IDs are accepted for text chat. Unverified modalities and edit
  schema support are refused explicitly. External availability and cost depend
  on the provider account.

## Release gates still requiring final evidence

- All required UI interactions, accessibility and both screen sizes must pass the
  full Electron scenario, not merely core or renderer tests.
- Packaged-app, real installer and uninstall behavior require actual Windows
  execution evidence for the final commit.
- The complete native FFmpeg dependency source/notice inventory and Sharp native
  distribution obligations must be verified before public binary redistribution.
- No live OpenAI or Gemini test has been run with a user-provided API key. Mock
  contracts do not validate model quality, billing or account availability.
- No signing certificate, verified public repository, published installer link,
  final release tag or downloaded-release checksum is currently recorded.

Use [implementation-status.md](implementation-status.md) for the current checked
results and remaining work; this document must be updated as evidence changes.
