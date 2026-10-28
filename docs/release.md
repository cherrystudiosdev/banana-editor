# Release procedure

Target: **Banana Editor v1.0.0**, tag `v1.0.0`, ordinary non-draft/non-prerelease
GitHub Release. This document is a procedure, not evidence of publication.
The project must not be labeled stable until all requirements in
[release-requirements.md](release-requirements.md) and the gates below pass.

## Current publication gates

The verified GitHub owner/repository identity and public release URL are not yet
recorded. Do not guess an account or publish into another project's remote. The
FFmpeg/native dependency source-provision inventory has unresolved items documented
in [third-party notices](../THIRD_PARTY_NOTICES.md). These remain release blockers,
not features deferred to a later version. Live API access is separately disclosed;
the application must remain fully usable without credentials.

## Build and verify one immutable commit

1. Verify remote URL, repository owner and authenticated GitHub identity. Preserve
   any existing release/tag; never overwrite a published tag or asset silently.
2. Complete required functionality and all documentation. Confirm version, icon,
   MIT attribution, dependency notices, binary provenance, source material and
   absence of secrets/development-machine paths.
3. Pin the candidate commit. On that exact commit run frozen installation, lint,
   typecheck, unit/integration/real-media tests, production build and Electron E2E.
4. Produce Windows x64 installer and optional portable artifacts with
   `pnpm package:win`. Retain all runtime DLLs, fonts, licenses and corresponding
   source material required for distribution.
5. Run packaged-app and installer tests on actual Windows. Verify import/export,
   font rendering, writable app data, startup without a development environment,
   uninstall preservation, and special-character paths. Record real results.
6. Compute SHA-256 for every final artifact and write `SHA256SUMS.txt`. Prepare
   release notes with supported platform, installation, features, AI setup,
   signing state, known limitations and license information.
7. Only after every mandatory gate passes, create/push `v1.0.0` for that exact
   commit and publish the Release titled `Banana Editor v1.0.0`. An internal
   draft may be used while uploading, but final state must be draft=false and
   prerelease=false. Mark Latest if appropriate.
8. Verify the tag resolves to the tested commit, Release states are correct, and
   asset names/sizes are correct. Download at least the installer from the actual
   release and compare its SHA-256 to the recorded checksum.
9. Check README repository/download links. Any source changes after verification
   need new checks; do not imply they were part of the previous run.

Validation and publication jobs must be separate. Publication needs successful
mandatory jobs, the correct immutable commit and minimum required permissions.
Use `contents: read` by default and `contents: write` only where publishing needs
it. Fork PR jobs must not receive secrets. Paid AI calls are not required in CI.

## Signing

No code-signing certificate is currently verified. If one becomes available,
consume it only through a secure CI secret. Do not commit certificates/passwords
or identify unsigned artifacts as signed. Windows may warn about an unsigned
installer; release notes and installation instructions must say so.

## Checksums

After downloading a real release artifact, Windows users can inspect its hash:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath '.\downloaded-installer.exe'
```

Compare the result with the exact corresponding line in `SHA256SUMS.txt` from the
same release. This example names no nonexistent asset; final README links must use
the verified installer filename, not GitHub's generated source archive.

## Authoritative references

- [GitHub CLI release create](https://cli.github.com/manual/gh_release_create)
- [GitHub releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security)
- [FFmpeg distribution guidance](https://ffmpeg.org/legal.html)
