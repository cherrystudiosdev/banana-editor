# Security

## Supported release status

The project is working toward 1.0.0. No published stable release or security
support window is currently verified. New findings are evaluated against the
current development source; release support dates must be published with an
actual release.

## Reporting

When the public repository enables GitHub private vulnerability reporting, use
its Security → Report a vulnerability form. A public repository URL and dedicated
security email have not yet been verified. Do not invent a destination or post
API keys, private media, exploit payloads or personal paths in public issues.
Use an available private maintainer channel to arrange a report if necessary.

Include the version/commit, operating system, affected boundary, minimal
reproduction, expected result and security impact. Prefer synthetic media. Remove
credentials and sensitive project content from diagnostic material.

## Boundaries

Electron's renderer has no Node integration and uses context isolation and a
sandbox. Preload exposes named, typed operations, not arbitrary shell/filesystem
access. Main verifies the IPC sender and payload, validates imported media, and
runs FFmpeg with separate arguments and `shell: false`. Custom media URLs resolve
only to registered files; navigation and new windows are restricted.

API keys are main-process-only, encrypted using the OS facility when available,
and otherwise session-only. AI proposals contain allowlisted commands, are
validated locally, and need explicit Apply. Source text and filenames are
untrusted. Project schema versions newer than supported are rejected rather than
guessed. Saving/exporting must preserve prior good files on failure.

These design controls are not a substitute for testing. Relevant tests and
remaining verification gates are documented in [testing](docs/testing.md).
