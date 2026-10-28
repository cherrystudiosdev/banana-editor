# Banana Editor

**Open-source editing. Creative freedom.**

Banana Editor is an offline-first desktop video editor built with Electron,
React, TypeScript and native FFmpeg. Its original dark workspace uses a banana
yellow accent, a media library, source/program monitors, a multitrack timeline,
effect controls and optional OpenAI/Gemini assistance.

[Türkçe](README.tr.md) · [Architecture](docs/architecture.md) ·
[Project format](docs/project-format.md) · [Privacy](docs/privacy.md)

## Release status and user installation

Development targets **Banana Editor 1.0.0**. A version number in the source does
not establish a stable release. The release requirements remain in
[release-requirements.md](docs/release-requirements.md); actual completion and
test evidence are tracked in [implementation-status.md](docs/implementation-status.md).
There is no verified public installer or GitHub Release link yet.

The Windows release must include Electron, FFmpeg/ffprobe, their runtime libraries,
and the default font. End users will not need Node.js, pnpm, Python or a separate
FFmpeg installation. Download and installation instructions will point to the
verified installer asset when publication gates pass. Source archives are not
installers. No signing certificate has been verified; unsigned builds may trigger
a Windows warning and must not be described as signed.

The target runtime is Windows 10 **22H2 or later**, or Windows 11, x64. Electron
45.1.0 supports Windows 10+, while the selected FFmpeg build sets the stricter
22H2 requirement. macOS/Linux packages have not been verified or published.
The interface targets 1366×768 and larger screens. Cache and output files need
free local disk space; preview cache may be comparable in size to exported media.

## Implemented editing components

- Versioned `.banana` projects, runtime validation, atomic save, separate recovery
  saves, recent files, relative media references and relinking.
- Probed video/audio/image import, metadata, thumbnails, measured waveforms,
  compatible preview proxies, media folders and search.
- Integer-frame timelines with rational frame rates, multiple video/audio tracks,
  splitting, trimming, ripple edits, moving, selection, clipboard, linked clips,
  track controls, markers and transactional undo/redo.
- Position, scale, rotation, crop, opacity, brightness, contrast, saturation,
  fit/fill, fades, cross dissolve, volume and linear/hold keyframes.
- Titles and caption clips with Turkish glyph support; SRT/WebVTT conversion.
- A full-composition FFmpeg program preview and export pipeline with audio mixing,
  progress, cancellation and temporary-output validation. CPU WebM VP9/Opus and
  MP4 OpenH264/AAC are checked against the installed encoder capabilities.
- Optional OpenAI and Gemini SDK adapters: selected-media discussion, summaries,
  marker/title/short-cut suggestions, reviewed edit plans, transcription and
  caption correction/translation. API-free editing remains available.

These components are still subject to the full desktop, packaged-app and installer
release gates. Read [known limitations](docs/known-limitations.md) before relying
on an unverified build. Program playback uses a rendered composition cache; edits
require rebuilding that cache before synchronized playback.

## First edit and export

1. Create a project, then set resolution and rational frame rate in Sequence
   settings. Import does not silently change the sequence.
2. Import media or drop files into the library. Preview a source, then drag assets
   onto video/audio tracks.
3. Select clips to move, trim, split or adjust effects in Inspector. Normal Delete
   leaves the gap. Ripple Delete closes the selected time on affected unlocked
   tracks according to the [documented rules](docs/project-format.md).
4. Add titles/captions and markers. Rebuild the program preview to inspect the
   complete composition and mixed sound.
5. Save the project. Open Export, choose a destination, supported codec/format,
   resolution, frame rate, quality/audio options and caption burn-in, then export.
   Source media cannot be used as the export destination.

## Keyboard controls

| Shortcut | Action |
| --- | --- |
| Space | Play/pause |
| V / C | Selection / split tool |
| Delete | Delete selected clips, preserve gap |
| Ctrl/Cmd+Z | Undo |
| Ctrl/Cmd+Shift+Z | Redo |
| Ctrl/Cmd+S / O / I | Save / open / import |
| Ctrl/Cmd+C / V | Copy/paste when timeline has focus |
| Left / Right arrow | Step one sequence frame |

Editing shortcuts do not run while typing in text fields. Timeline trim handles
use Shift for ripple trimming. Track locks and source bounds are enforced by the
same command layer used by keyboard actions and AI proposals.

## Optional AI setup

Open Settings, enable Banana AI, select a provider/model, add that provider's API
key and test the connection. Keys stay in the main process and use operating-system
encrypted storage when available; otherwise they are session-only. The API key is
never saved into a project or renderer localStorage.

Before sending, review the provider, model, selection and media choices. The app
sends bounded selected ranges and frames; metadata-only requests cannot establish
what is spoken or shown in unseen media. Review a proposed edit before Apply;
one undo reverses it. Transcription timing capabilities vary by model and are
shown honestly. See [AI providers](docs/ai-providers.md) and [privacy](docs/privacy.md).
External API services have separate usage charges, terms and data policies.

## Developer installation

Use Windows x64, Node.js 24+ and **pnpm 11.25.0**. From the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm setup:ffmpeg
pnpm dev
```

The FFmpeg setup script verifies the pinned download checksum. Keep the complete
runtime directory, DLLs, font and license material. Public redistribution is
currently blocked until the native dependency source/notice inventory described
in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) is complete.

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
pnpm package:dir
pnpm package:win
```

`package:win` creates local NSIS/portable artifacts; producing an artifact does
not prove installation or release readiness. Follow [testing](docs/testing.md)
and [release](docs/release.md) for the required checks. Development dependencies
are pinned and the lockfile must remain committed.

## License and contributing

Original Banana Editor source is [MIT licensed](LICENSE), copyright 2026 Banana
Editor contributors. Bundled components retain their own licenses, including
FFmpeg LGPLv3, Noto Sans OFL, Lucide ISC, and SDK/native-library notices. See
[third-party notices](THIRD_PARTY_NOTICES.md), [contributing](CONTRIBUTING.md),
[security](SECURITY.md) and [code of conduct](CODE_OF_CONDUCT.md).

Professional video-editing workflows were studied using Adobe's public
documentation. Banana Editor is independently developed, is not affiliated with
or endorsed by Adobe, and does not claim Premiere project-file compatibility.
