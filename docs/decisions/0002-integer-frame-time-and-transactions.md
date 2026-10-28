# ADR 0002: Integer sequence frames and atomic editing transactions

Status: accepted. Date: 2026-10-28.

Timeline positions/durations use safe integer frames with rational FPS. Source
time and audio samples remain distinct concepts. Intervals include their start
and exclude their end. This avoids repeatedly accumulating rounded seconds at
30000/1001 and other fractional rates.

Every editing action is a validated command transaction. Commands operate on a
copy; errors cannot partially alter a project. History stores whole transactions.
A drag or reviewed AI plan enters history once. Revisions increase through edits,
undo and redo, preventing a stale AI proposal from appearing current again.

Same-track overlap requires explicit cross-dissolve data with matching duration.
Source bounds, linked groups and track locks are shared invariants. UI convenience
must never bypass these rules.
