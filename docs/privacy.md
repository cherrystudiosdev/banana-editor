# Privacy

Banana Editor's local editing workflow works offline without an account. The
application contains no telemetry or advertising integration. Source media is
read for editing and export; removing an asset from a project does not delete
the source file.

Projects contain timeline edits and media references. They can reveal source
filenames and project content, so share them intentionally. `.banana` files do
not contain API credentials. Local application data includes settings, recent
project locations, cached media derivatives and a recovery project. Cache can
be cleared from the application; clearing cache does not remove source media.

AI is disabled by default. Enabling it and adding a credential does not send
media by itself. A request sends the selected provider/model, the user's prompt,
selected timeline metadata and the media/text types shown in the request
confirmation. The renderer supplies selection and permission choices; main
prepares the bounded media. Filenames and transcript contents are data, not
trusted model instructions. Provider outputs are untrusted and validated locally.

API credentials are used by the main process. On Windows, Electron safeStorage
uses the operating system's encryption facility. If encrypted persistence is
unavailable, the application keeps credentials in session memory and reports
that state. Credential values are not returned by settings reads, stored in
localStorage, placed in project files, embedded in the renderer build, or written
to application logs. Entered key fields are cleared after transfer to main.
The user can delete a provider's saved key and disable AI in Settings.

Both adapters request stateless responses (`store: false`). This setting is not
a promise about provider-wide retention, abuse monitoring, account policies, or
legal obligations. Review the selected provider's current terms and data policy
before sending sensitive material. API services have their own charges and
conditions, separate from Banana Editor's MIT source license. Cancelling locally
does not guarantee that the provider cancels processing or reverses charges.

The implemented adapters send small inline media inputs rather than creating
remote file objects. Model requests receive no filesystem, shell, network-tool,
credential-reading or code-execution capability. Only a validated proposal can
reach the editor, and the user must choose Apply before it changes the project.
