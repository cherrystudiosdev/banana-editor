# Banana Editor

Read docs/implementation-status.md before continuing unfinished release work.
The approved scope is preserved in docs/release-requirements.md. Do not call
the project stable or publish v1.0.0 until every release gate is verified.

- Keep editor core independent of React and Electron. All edits are atomic commands.
- Timeline positions/durations are integer frames; fps is rational; sourceIn is seconds.
- Never change source media. Validate every IPC sender and payload.
- No general-purpose filesystem/shell bridge, secrets in renderer, or fabricated tests.
- Run pnpm typecheck, pnpm lint, pnpm test, pnpm build and real Electron/packaged tests.
- The installed application must include FFmpeg, ffprobe, fonts and required licenses.
- Respect existing files. Do not publish to an unverified account or overwrite a release.
- Record actual test evidence and remaining required work in implementation-status.md.
