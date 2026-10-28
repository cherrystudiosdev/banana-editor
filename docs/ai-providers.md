# Banana AI providers

AI is optional. Import, editing, saving and local export do not require an API key.
Provider and model selection are explicit; the application never silently changes
providers. API service charges and terms are separate from the MIT application
license. No live API test has been performed without a user-supplied credential.

## Implementation

The main process owns `AIService` and the official SDK clients. OpenAI uses
`openai` Responses (`responses.create` and `responses.parse` with
`zodTextFormat`) and the separate `audio.transcriptions.create` endpoint.
Gemini uses `@google/genai` Interactions with JSON Schema output. Both request
`store: false`, expose no model tools, and pass cancellation to the SDK.

Verified documentation defaults as of 2026-10-28 are `gpt-6-astra` for OpenAI
text/image requests, `gpt-transcribe` for OpenAI file transcription, and
`gemini-3.8-flash` for Gemini. Defaults are editable in Settings. Model/account
availability is checked with the provider's model retrieval endpoint when the
user tests the connection; this does not prove every generation feature works.
The local capability registry deliberately grants only verified modalities.
Custom identifiers can use text chat; unsupported structured or media actions
give an explicit error rather than assuming capabilities.

| Adapter | Supplied evidence | Transcription timing |
| --- | --- | --- |
| OpenAI Responses | Selected still frames, transcript and minimal timeline metadata | Audio uses the separate transcription adapter |
| OpenAI `gpt-transcribe` | Bounded extracted audio chunks | Chunk boundaries only; no invented word/segment times |
| OpenAI `whisper-1` (user-selected legacy model) | Bounded extracted audio chunks | Provider segment times, with each chunk's source offset restored |
| Gemini Interactions | Selected frames, bounded inline audio or video | Structured segment times are model estimates and require review |

The legacy OpenAI `whisper-1`, `gpt-4o-transcribe` and
`gpt-4o-mini-transcribe` models have a documented February 26, 2027 shutdown date.
The UI result warns when they are selected. The default uses the current file
transcription model. No word highlighting or word timestamp capability is
advertised.

## Sending evidence

The UI identifies provider, model, selected clips and requested media before
sending. Main extracts selected intervals; the adapters cannot read files.
`PreparedMedia` carries bytes, clip identity, MIME type, source start and duration.
Each part is limited to 20 MB, a batch to 32 MB and 64 parts, and an audio chunk
to 30 seconds. The adapter validates these bounds against the selected clip.
It sends inline media, so there are no remote Files API objects to clean up.
Full source files are never required as an adapter input.

Metadata excludes source paths, proxy paths, thumbnails, credentials and unrelated
asset records. The selected clip names, effects, text, frame ranges and anonymous
track occupancy are included when needed to produce valid edit proposals.
If no frames/audio/transcript were supplied, the result explicitly warns that it
received only metadata. The system instruction prohibits inferring unseen scenes
or unheard speech and treats filenames/transcripts as untrusted content.

## Workflows and validation

`AIService.execute(request, key, signal)` supports chat, summary, marker proposals,
title/description suggestions, short-cut proposals, structured edit proposals,
transcription, and selected-caption correction/translation. Title/description
suggestions are text; actionable titles can also be requested as an edit plan.

Plans contain schema version, unique plan ID, project/sequence identity, base
revision, explanation, and allowlisted steps. Local validation rejects unknown
operations/fields, unselected clips, locked tracks, invalid source/timeline times,
forbidden overlaps, stale revisions, replay and unintended linked-clip changes.
A dry-run uses the same editor commands as the UI. No shell, path or arbitrary
JavaScript operation exists in the plan language.

The user reviews the proposal before Apply. `applyEditPlan` returns a new project
for one `History.commit`; one undo reverses the entire plan. Caption translation
returns only clip IDs and text; locally generated commands preserve original
caption timing and styling. Transcription maps source timestamps to the rational
sequence time base and generates a caption proposal only when an unlocked video
track has free space. Otherwise the transcript is retained and the user is told
to provide room for captions.

Requests have a 120-second timeout and at most two exponential-backoff retries
for transient network, rate limit or server failures. Authentication, schema,
quota and model errors are not retried. Provider error messages are replaced
with normalized local messages so echoed secrets/prompts cannot reach UI logs.
Cancellation stops local waiting and requests cancellation through the SDK; a
provider may still complete or bill work already accepted.

## Tests and evidence

`pnpm test:core` includes AI tests. `node node_modules/vitest/vitest.mjs run tests/ai`
also runs these tests directly. Contract fixtures exercise OpenAI's actual SDK
HTTP serialization and Gemini's SDK method boundary, schema rejection, source
offset restoration, transcript-to-caption mapping, scope/lock/revision/replay
rules, atomic undo, preservation of translated timing, bounded retry, timeout,
cancellation and secret-safe error/context handling. Fixtures are test data and
are never displayed as live responses. Live account access, content quality,
actual billing and service latency remain unverified until a credentialed smoke
test is recorded.

## Official references

- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI transcription workflows and deprecations](https://developers.openai.com/api/docs/guides/transcription)
- [OpenAI file transcription](https://developers.openai.com/api/docs/guides/speech-to-text)
- [GPT-6 Astra model documentation](https://developers.openai.com/api/docs/models/gpt-6-astra)
- [Gemini Interactions overview](https://ai.google.dev/gemini-api/docs/interactions-overview)
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini video understanding](https://ai.google.dev/gemini-api/docs/video-understanding)
- [Gemini audio understanding](https://ai.google.dev/gemini-api/docs/audio)
- [Google GenAI JavaScript SDK reference](https://googleapis.github.io/js-genai/release_docs/)
