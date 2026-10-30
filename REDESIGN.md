# Obfuscation redesign — 2026-10-19 (historical)

This document records the October 19 redesign, not current product configuration. The later October 23 removal of Disable line information supersedes the disabled/pending descriptions below; the option is absent from active UI and new jobs. Historical evidence is retained.

## Confirmed before changes
- `src/pages/Dashboard.tsx` rendered an icon rail on desktop and a compact mobile header; it persisted `.light` via `lurapy_theme`.
- `src/components/ObfuscationTab.tsx` owned input, settings and ephemeral output. It called `validateLuaSyntax` on the interface thread and `obfuscateWithSteps` directly; settings used `lpy_platform`, `lpy_level`, `lpy_toggles`.
- `src/lib/obfuscator/engine.ts::obfuscateWithSteps` advanced seven display steps with fixed delays. Actual transformation happened in `tryObfuscate`, followed by structural validation in `obfuscateWithRetry`.
- No worker or artifact persistence existed in that browser flow. Access was a shared local Key gate, not individual user identity.
- `platforms.ts` already disabled Disable Line Information. `vm-codegen.ts` only changes formatting breaks for non-direct paths; direct mode already emits one line. The existing deterministic test explicitly proves both values produce identical direct output.

## Implemented structure
- `Dashboard.tsx`: full-width header/nav, existing Key/logout/route contracts and theme persistence.
- `ObfuscationTab.tsx`: stable upload/result/error panel, copy/download, accessible status focus, modal and history composition.
- `ObfuscationModal.tsx`: Radix focus trap and inert background, real settings, independent upload/paste buffers, file-name and empty/extension validation, source retained only in memory.
- `ObfuscationProgress.tsx`: three lifecycle stages; indeterminate active bars and an explicitly estimated completed-stage percentage. 100% requires an actual nonempty result.
- `useObfuscationJob.ts`: worker ready handshake before acceptance, synchronous duplicate guard, job identity checks, typed events, crash handling and origin-wide Web Lock. No fallback to expensive main-thread generation.
- `obfuscation-worker.ts`: the same shared engine as CLI; validation/parsing/generation run inside worker. Events do not consume randomness or change generation options.
- `history-store.ts`: IndexedDB exact Blob artifacts and metadata; composite date/id ordering, pagination, update by job id, deletion, cross-tab refresh, reconciliation under generation lock, storage operation timeouts.
- `RecentObfuscations.tsx`: empty/loading/error states, pagination, download stored bytes, confirmed deletion, local/privacy limitation.
- `obfuscation.css`: scoped neutral/cyan theme, purple upload panel, responsive modal and progress, reduced-motion behavior. Login intentionally unchanged.

## Lifecycle policy
Only one generation per origin is allowed at once across tabs. A tab must acquire the Web Lock before reconciling old unfinished records. Closing/navigating terminates its worker; browser page-close warns during an active job. Unmount records an interruption; a hard close is reconciled on the next lock acquisition. Opening another tab must not label an active lock holder as interrupted. Browsers without Web Locks show an explicit unsupported-coordination message instead of risking conflicts.

Generation has no arbitrary execution deadline. A worker-loading timeout applies only before readiness. IndexedDB open/write timeouts allow the flow to proceed without persistence. The result stays in memory and downloadable if persistence fails. Successful results are recorded before releasing the origin lock. Failed history stores a generic summary, not parser details that might quote source. No code/outputs are sent to Cloud. Logout does not delete shared-browser history.

## Visual choices
Latest user brief replaces earlier rail, purple-dominant surfaces and circle-in-checkbox preferences only on this page. Dark neutral #191919/#2B2B2B/#353535, foreground #FAFAFA, secondary #A8A8A8, cyan #9DECF5 and purple #593A91→#A15AB2; stages cyan/#FFC400/#F48363. Poppins headings/primary buttons; Inter reading. The generated dotted-wave bitmap is not a copy of the reference screenshot. Uploaded screenshots are not embedded.

Fonts use exact locally served WOFF2 files under `public/fonts`: dependency filesystem font URLs returned 403 in this sandbox, and CDN pointer paths return HTML on bare localhost. CDN pointer records also exist for hosted asset provenance; local serving guarantees the same readable preview. No remote CSS imports.

## Validation evidence
- Full Vitest run: **186 passed, 12 skipped, 14 files passed**. The 12 skips concern unavailable legacy runtimes, not the LuaU regressions. Initial download permission issue for `luau-compile` was corrected and its tests passed.
- 10 added tests: event/output determinism and observer isolation, invalid source, artifact-gated 100%, retry reset, extensions, exact saved metadata/artifact, stable pagination, deletion and active-job reconciliation.
- Browser end-to-end: actual Key login, pasted code, LuaU level 2, generation, download, reload and history redownload; files byte-identical. Download executed with official Luau and printed 1 through 8. One line, no literal Roblox or hexadecimal escapes in this checked artifact.
- Browser edge cases: empty input, invalid source -> error -> preserved retry input; real file upload with GC Fixes; other tab holding the real origin Web Lock; injected quota failure with immediate download preserved; confirmed artifact deletion; focus remained inside dialog across repeated Tab presses.
- Dark/light layouts exercised at 360, 390, 768 and 1440 CSS px, no document overflow; final button accessible. Paste editor scrolls inside the modal, not off-screen. Reduced-motion state checked. Font loading confirmed with loaded Poppins and Inter, not fallback text.
- Browser screenshots/scripts and raw execution logs are temporary under `/tmp/browser/redesign`; unit tests remain in the project. Preview build log reported build OK.

## Explicit limitation / not claimed complete
**Disable Line Information has no meaningful operation in direct one-line output.** It remains visible with its pre-existing disabled state and an explicit limitation; this is a pending functional requirement, not a redesign shortcut or a made-up effect. Removing traceback metadata would require a separately specified runtime contract and must not silently change the compiler or switch to a source-compiling loader. Its behavior was not weakened by this redesign.

No Studio validation, production deployment, speed superiority, source secrecy or equivalence to Luraph is claimed. Final validation is structural generation plus the existing offline functional tests; Studio behavior remains separately pending.
