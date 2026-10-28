# Contributing

Read [AGENTS.md](AGENTS.md), [architecture](docs/architecture.md), and the current
[implementation status](docs/implementation-status.md) before changing the editor.
The approved 1.0.0 scope remains in [release requirements](docs/release-requirements.md).
Do not reduce that scope or call incomplete work a stable release.

Use the pinned pnpm version and lockfile. Keep the framework-independent core
separate from Electron and React. All project edits must pass through atomic
commands, preserve integer-frame/rational-FPS semantics and validate at runtime.
Preserve source files and user changes. UI shortcuts and AI actions must not
bypass locks, undo, source limits, selection scope or revision validation.

Add meaningful regression tests for behavior that can lose data, desynchronize
timing, produce wrong media, leak credentials or change security boundaries.
Use deterministic, locally generated media rather than private footage. Run:

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

Changes to packaging require actual Windows packaged-app and installer checks.
Record precisely which commands/platforms ran; do not label mocked API responses,
renderer-only builds or cross-builds as live/installed-app validation.

Keep English and Turkish strings aligned. Use accessible labels, visible focus,
and disabled states for unavailable actions. Include documentation and release
notes when behavior changes. New dependencies need pinned versions, compatible
licenses, copied notices and a source-provision review for shipped native code.

Pull requests should explain the concrete problem, final behavior, tests and
remaining risks. Remove secrets and personal paths from shared logs. Contributions
to original application code are accepted under the project's MIT license;
third-party code retains its own license and attribution.
