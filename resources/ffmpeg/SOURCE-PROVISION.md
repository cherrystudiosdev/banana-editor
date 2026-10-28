# FFmpeg source provision and redistribution gate

This runtime is FFmpeg `n9.0.2-36-g6882969ce9-20261027`, Windows x64,
shared-library LGPL variant, built by BtbN. It is **LGPL-3.0-or-later**, not MIT.
Its configuration enables version 3 and does not enable GPL or nonfree components.
The application invokes it as a separate process. This does not remove its license obligations.

The complete FFmpeg source at the exact compiled revision and the build recipes are
included under `source/`:

| File | SHA-256 | Upstream |
| --- | --- | --- |
| ffmpeg-6882969ce9.tar.gz | 9dc825750d71d51a9c8d45516ad3ffdf05e74f029a66f8c3efaf431ed7331701 | https://codeload.github.com/FFmpeg/FFmpeg/tar.gz/6882969ce9fd2aa6aa1d0008b2bfe1c838aac11d |
| build-recipes-b4a2b1d.tar.gz | e250ee310b7a033fe28781f569015183ae320937ffe5722c34226e27ee12c892 | https://codeload.github.com/BtbN/FFmpeg-Builds/tar.gz/b4a2b1d7cc241786eb8e2b588a7ade40cad48bbd |

The dynamic libav DLLs can be replaced by compatible user-built versions. There is
no application check preventing that replacement. Include both `COPYING.LGPLv3`
and `COPYING.GPLv3` when distributing this runtime.

**Public redistribution remains gated:** the upstream binary includes additional
libraries statically linked into the libav DLLs. The exact corresponding source
and notices for those libraries must also be collected and checked before a public
release. The build recipes alone and a link to upstream do not establish that this
obligation has been fulfilled. `BUILD-CONFIGURATION.txt` lists enabled components.
Do not describe the current third-party license inventory as complete.

In particular the runtime enables OpenH264, libvpx, Opus, dav1d, AOM, SVT-AV1,
rav1e, LAME, Vorbis, Theora, libass, FreeType, HarfBuzz, FriBidi, Fontconfig,
libbluray, libopenmpt, libgme, GMP, Gnu iconv, libxml2, libssh, librist, SRT,
libplacebo, libjxl, libwebp, libopenjpeg, libzimg, zlib, lzma and other components.
Consult the exact configuration and build recipes rather than treating this
illustrative list as an exhaustive software bill of materials.

Runtime supported by upstream on Windows 10 22H2 or newer, x64.
Source: https://github.com/BtbN/FFmpeg-Builds/tree/b4a2b1d7cc241786eb8e2b588a7ade40cad48bbd
