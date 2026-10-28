# Third-party notices

Original Banana Editor source is MIT licensed. This does **not** relicense
third-party software, fonts, icons, binaries or API services. The complete license
text and attribution shipped by each dependency must accompany distribution.

## FFmpeg and ffprobe

- Actual runtime: `n9.0.2-36-g6882969ce9-20261027`, Windows x64, shared libraries.
- Builder: [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds), release
  `autobuild-2026-10-27-18-38`.
- Download: `ffmpeg-n9.0.2-36-g6882969ce9-win64-lgpl-shared-9.0.zip`.
- SHA-256: `f70e43c4f5670fbbf2dc4eb667b0d6b3743d68386f766c08bb2e0ec3edece398`.
- License: **LGPL-3.0-or-later**. The actual build uses `--enable-version3` and
  `--enable-shared`; GPL/nonfree switches are not enabled.
- Exact FFmpeg revision: `6882969ce9fd2aa6aa1d0008b2bfe1c838aac11d`.
- Exact build recipes: `b4a2b1d7cc241786eb8e2b588a7ade40cad48bbd`.

[Provenance](resources/ffmpeg/provenance.json),
[build flags](resources/ffmpeg/BUILD-CONFIGURATION.txt),
[source provision](resources/ffmpeg/SOURCE-PROVISION.md),
[LGPLv3](resources/ffmpeg/COPYING.LGPLv3) and
[GPLv3](resources/ffmpeg/COPYING.GPLv3) are preserved. The setup script obtains
the exact FFmpeg source archive and builder recipes with recorded hashes.
The complete `resources/ffmpeg` runtime directory, including DLLs, must be shipped;
users can replace compatible DLLs with their own builds.

The tested export codecs are libvpx-vp9/Opus in WebM and libopenh264/AAC in MP4.
Other enabled dependencies include AOM, dav1d, SVT-AV1, rav1e, LAME, Vorbis,
Theora, libass, FreeType, HarfBuzz, FriBidi, Fontconfig, libbluray, libopenmpt,
GMP, iconv and many others listed by the exact configuration. These are separate
third-party works with their respective licenses; the short list is not a
complete native software bill of materials.

**Public redistribution is blocked until the exact corresponding source and
notices for all additional libraries statically incorporated into the libav DLLs
are collected and verified.** Bundling the main FFmpeg source and build recipes
alone does not establish completion. Invoking FFmpeg in a separate process does
not remove its distribution obligations. See the runtime's
[SOURCE-PROVISION.md](resources/ffmpeg/SOURCE-PROVISION.md) and
[FFmpeg's legal page](https://ffmpeg.org/legal.html).

## Electron, Chromium and Node.js

Electron **45.1.0** is MIT licensed and embeds Chromium/Node.js and their
dependencies. The installed Electron distribution provides `LICENSE` and
`LICENSES.chromium.html`; both must remain in packaged output. Electron's
[versioned platform statement](https://github.com/electron/electron/blob/v45.1.0/README.md)
supports Windows 10+ x64; the bundled FFmpeg runtime further requires Windows 10
22H2+. Electron's upstream copyright and third-party notices are not replaced by
the application's MIT file.

## JavaScript and native image dependencies

The installed production dependency graph and Electron manifests are inventoried
in [third-party-inventory.md](docs/third-party-inventory.md) and the corresponding
[JSON inventory](docs/third-party-inventory.json). Copied license/notice texts are
in `docs/third-party-licenses/`; include that directory in distribution.

| Direct dependency | Version inspected | License |
| --- | --- | --- |
| React / React DOM | 19.3.1 | MIT |
| Zustand | 5.0.16 | MIT |
| Zod | 4.6.7 | MIT |
| Lucide React icons | 1.63.0 | ISC |
| OpenAI Node SDK | 7.45.1 | Apache-2.0 |
| Google GenAI SDK | 2.31.0 | Apache-2.0 |
| Sharp | 0.35.5 | Apache-2.0 |
| Sharp Windows x64 native package | 0.35.5 | Apache-2.0 AND LGPL-3.0-or-later |

Sharp's platform package includes native image/text libraries. Its own license
bundle must be preserved; the native corresponding-source and notice inventory
must be checked in addition to the JavaScript manifest inventory. The inventory
is not a claim that all embedded native licensing requirements are complete.
Build/test tooling versions are pinned in `package.json` and `pnpm-lock.yaml`.

## Fonts, artwork and test media

Noto Sans Regular is distributed under **SIL Open Font License 1.1**. The actual
font, [license](resources/fonts/OFL.txt) and
[provenance/hash](resources/fonts/provenance.json) are included. The font was
obtained from notofonts/noto-fonts revision
`ffebf8c1ee449e544955a7e813c54f9b73848eac` and its SHA-256 is
`b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5`.

The Banana logo/application artwork is original project work. Lucide icons retain
their ISC license and upstream attribution. Deterministic color, sine-wave and
text fixtures are generated locally by test code; they do not contain licensed
stock footage, music or a real AI response. No Adobe code, logo or screenshot is
included, and Adobe affiliation/endorsement is not implied.

## API services

OpenAI and Google Gemini services are optional external services. SDK licenses
do not grant free API usage or determine service terms, billing or data retention.
Users supply their own credentials and accept the selected service's current
conditions. No subscription, watermark, feature payment lock or telemetry service
is added by Banana Editor.
