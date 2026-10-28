# ADR 0004: AI proposes; validated editor commands apply

Status: accepted. Date: 2026-10-28.

AI providers run in main with user-selected models and credentials. They receive
only approved selected evidence and metadata. They have no file, shell, code or
credential tools. Output is treated as untrusted regardless of provider schema
enforcement.

An edit plan identifies its project, sequence, base revision and unique plan ID.
Allowlisted commands are checked against selection, locks, source/timeline bounds
and overlap policies. A local dry-run validates all steps before review. Apply
commits one transaction; one undo reverses it. Replay and stale plans are rejected.

Caption translation changes text only, preserving local segment timing. Model
timing capabilities are disclosed; missing word timestamps are never synthesized
and advertised as precise speech alignment. Cancellation cannot promise to reverse
provider billing or retained data.
