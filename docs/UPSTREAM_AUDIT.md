# Upstream panel integration audit

## Scope and provenance

- Destination: CloudProxyz `custom`, starting at `478b416`.
- Source: `router-for-me/Cli-Proxy-API-Management-Center`, `main` at `c9e2f7c`.
  Fetch and a final remote-ref check confirmed that tip. All 15 outstanding commits are merged.
- The checkout already contained an unfinished merge with 18 conflicted paths. Resolved it
  without aborting or replacing the CloudProxyz branch. The untracked
  `src/components/ui/Mascot.tsx` is unchanged and excluded from the commit.
- Backend evidence: read-only inspection of `../CLIProxyAPI` at `0f96f568` and fetched
  `origin/main` at `d318bcc3`; no backend source was modified. Both register plugin-ID quota
  endpoints in `internal/api/server_management_v8.go`, not a generic `/quota/fetch` endpoint.
- Review boundary: detailed source/contract review of incoming OAuth, config, localization,
  quota and shared-client changes, plus the surrounding authentication/cache integration.
  Full regression suite and route smoke tests were run; this is not a claim of exhaustive
  review of every pre-existing feature, backend implementation, or third-party dependency.

## Incoming commits

| Area | Commits | Integration |
| --- | --- | --- |
| OAuth gallery, dialogs, Kimi assets and sponsor actions | `c9e2f7c`, `6e77824`, `1f5fd84` | Feature layout retained; CloudProxyz graphite styling and settled first paint preserved |
| Callback polling recovery | `00bb5a3` | Accepted callbacks resume stopped polling; cancellation guards retained |
| Config setting rows, API-key rows, controls | `0c54719`, `b1f708d`, `16f1962`, `8ba200d`, `c332bc9` | Accessible labels and responsive rows merged; local dirty markers restored |
| Plugin quota, reset-row layout, xAI usage | `e70b37a`, `350d808`, `77f10d5` | Plugin quota transported through verified v8 routes; xAI shared quota semantics preserved |
| Korean and Vietnamese translations | `f03160e`, `5aa1ad6`, `346eaa2` | All six locales retained; Korean extended with 94 fork-specific labels and brand interpolation |

## Findings fixed

| Severity | Location | Finding and resolution |
| --- | --- | --- |
| High | `src/services/api/pluginQuota.ts` | Incoming generic quota route does not exist in v8. Resolve the enabled plugin's declared quota provider through `/plugins`, then POST to `/plugins/:id/quota`. Guard the dependent request against connection changes. Never fall back to v0. |
| High | `src/services/api/client.ts` | Late responses could emit old version/plugin headers or a 401 logout into a new session. Capture connection revision synchronously at dispatch; reject stale successes and failures before emitting events, including A→B→A switches. |
| High | `src/stores/useAuthStore.ts` | Old login/checkAuth results could overwrite newer authentication state or resurrect a logged-out session. Gate success and failure writes by connection revision. |
| High | `src/features/oauth/hooks/useVertexImport.ts` | An upload could complete into a different connection, increment its credential count, or leak the old import result. Abort/invalidate on session changes and unmount; prevent duplicate imports and disable file/region edits during upload. |
| Medium | `src/features/oauth/hooks/useOAuthFlows.ts` | Plugin discovery tracked only server URL. It now tracks the management key, authentication and plugin support too, with immediate invalidation and cancellation. |
| High | `src/features/oauth/OAuthPage.tsx` | Imported `useRevealGroup` no longer exists in this fork, breaking compilation. Remove the import and decorative cascades rather than reintroducing removed motion. |
| Medium | `src/features/config/components/fields/FieldPrimitives.tsx` | Replacing FieldAnchor with new rows dropped modified-field feedback. Restore localized visible markers for settings, cells and remaining block anchors. |
| Medium | `src/features/quota/health.ts` | Reset-time filtering could classify exhausted quotas as healthy; xAI's shared quota was lost when product limits were removed. Compute capacity independently of reset scheduling and use only xAI's shared weekly usage. |
| Medium | `src/services/api/pluginQuota.ts`, `src/utils/quota/builders.ts` | Null/malformed optional plugin metrics or buckets could throw during normalization. Narrow untrusted records, reject non-finite values and deduplicate metric identities while preserving zero. |
| Medium | `src/i18n/locales/ko.json` | New locale lacked custom navigation, login, quota and other labels and used upstream branding. Add Korean translations and the shared `{{brand}}` interpolation. |

Probe-only credentials have no corresponding generic v8 route in either inspected backend.
They now show a translated unsupported-capability error rather than making a nonexistent
request or bypassing the v8-only requirement. Real plugin providers continue to work through
plugin-ID routes. This remaining backend limitation is explicit, not silently emulated.

## Interface review (full mode, bounded to changed surfaces)

React 19, existing SCSS Modules and theme tokens; no new styling or browser-test framework.

| Category | Evidence inspected | Result |
| --- | --- | --- |
| Typography | OAuth tiles/header, config labels, Korean mobile screenshots | Wrapping and shared heading scale preserved; changing counts use tabular numerals |
| Surfaces | OAuth tiles/dialogs, config groups, quota card | Graphite tokens retained; incoming sponsor gradients removed |
| Animations | OAuth page/tiles/status/view transitions and reduced-motion CSS | Removed decorative entrance/status/success loops; dialog timing uses shared tokens |
| Icons | Kimi, provider fallbacks, trailing actions, focus outlines | Bundled icons retained; icon-only actions keep accessible names |
| Performance | Build artifact, transitions, route smoke tests | Single inline artifact; no external build-asset requests in production smoke test |

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| Medium | `src/features/oauth/components/ProviderTile.module.scss:5`, `OAuthHeader.tsx:18`, `OAuthHeader.module.scss:1`, `OAuthFlowDialog.module.scss:118` | Delayed entrances, breathing dots, staged success drawing and an obsolete reveal hook | Settled first paint, static text/dot status, shared heading and token-timed dialog transitions | Motion restraint and consistency with this fork |
| Medium | `src/features/oauth/components/ProviderTile.module.scss:48`, `:121`, `:135`, `OAuthFlowDialog.module.scss:592` | Truncated labels, 30px registration targets, blue sponsor gradients/actions | Wrapping names/captions, 40px registration targets (44px mobile), neutral theme surfaces | Room for translations, touch targets and shared surface hierarchy |
| Medium | `src/features/config/components/fields/FieldPrimitives.tsx:69`, `:296`, `:375`; `Field.module.scss:8`, `:101`, `:175`, `:390`; `../SectionCard.module.scss` | New rows lost dirty feedback and collided with the fork's tight card spacing | Visible localized modified markers, theme-token surfaces/type and group spacing | State must not depend on color alone; preserve readable grouping |

Considered but rejected:

- Restoring reveal/count-up helpers: conflicts with the intentional minimal-motion fork.
- Reverting the gallery to the old OAuth page: loses the upstream focused-flow and polling work.
- Replacing the shared Modal/Select primitives: unnecessary; browser focus restoration and
  existing accessibility regression tests passed.

UI verdict: no remaining blocker found in checked paths. Screen-reader testing, every hover/error
state, animation playback at 10% speed, and every locale on every viewport were **not verified**.

## Toolchain and dependency audit

The operator requested latest stable Bun. Registry resolution (`bunx bun@latest --version`)
confirmed **1.4.2**, matching the installed executable. Updated `packageManager`, both GitHub
workflows, both READMEs and AGENTS.md to that version; a regression test prevents version drift.
CI now also runs for pushes to the fork's `custom` branch. Local Node was **26.10.0**; CI retains
Node **24**. The future native Vite config warning was resolved using `import.meta.dirname`.

Updated compatible direct/transitive releases and regenerated only `bun.lock`, including Axios
**1.20.0**, React **19.3.0**, React Router DOM **7.18.4**, and Vite **8.3.4**.

- Initial dependency audit: **32** advisories (22 high, 9 moderate, 1 low).
- Final `bun audit --prod`: **0 vulnerabilities**, 69 packages checked.
- Final `bun audit`: **1 high**, build-tool-only `braces@3.0.3`, via
  `vite-plugin-singlefile → micromatch` and Sass's optional watcher.
  [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) concerns stack exhaustion
  on deeply nested glob patterns. Registry latest was still 3.0.3, with no published patched
  release. Do not feed untrusted glob patterns to this toolchain; track the upstream fix.
  No advisory was suppressed and no unverified replacement library was forced into the build.

## Dead-code and unused-file cleanup

The operator also requested cleanup before committing. Ran Knip **6.41.0** in normal and
production modes, then checked references across application code, tests, styles, documentation
and the ignored local preview before removing anything. Knip was run temporarily through Bun;
no new project tooling dependency or configuration was added.

- Removed five unused tracked files: `src/assets/logoInline.ts`, `src/pages/LogsPage.tsx`, and
  the three files under `src/components/ui/Table/`. Routes already import the logs feature
  directly, and the application uses `brandMark.ts`, not the old embedded JPEG.
- Removed unused `IconFilterAll`/`IconHeart`, section-number labels, bucket-to-minute helper,
  default credential-weight constant, and obsolete provider badge-color lookup/palette/types.
  Updated the Devin regression test to retain its active logo and provider-label assertions.
- Trimmed unused excluded-model barrel re-exports; kept the implementations and direct imports
  used by components and tests.
- Removed redundant direct ESLint plugin/parser dependencies; the configured `typescript-eslint`
  package still supplies them. Declared directly imported CodeMirror search/state/view packages
  explicitly and routed the navigation guard through the existing `react-router-dom` dependency.
- Updated repository guidance for the removed logs wrapper. Retained documentation images,
  dynamically selected styles, test entry points and helpers, and internally used exported types.

The final normal-mode scan finds no unused **tracked** modules, unused declared dependencies,
unlisted dependencies or unresolved imports. Its full report remains nonzero for the intentionally
preserved untracked `Mascot.tsx` and unused export/type boundaries whose implementations remain
in use; no blanket automatic deletion or claim of zero Knip diagnostics is made.

## Verification

Final runs used **Bun 1.4.2**:

- `bun install --frozen-lockfile` — pass, no lockfile changes.
- `bun run verify` — **1,609 tests passed across 167 files**, zero failures; TypeScript and
  production build passed. ESLint has zero errors and two pre-existing warnings:
  `preview.local/main.tsx:88` (ignored local preview) and
  `src/components/common/PageTransition.tsx:182` (hook dependency).
- `bun audit --prod` — pass. `bun audit` — nonzero for the single residual tooling advisory above.
- `git diff --check HEAD` — pass; no conflict markers/unmerged index entries.
- Chromium with Playwright (existing external installation, no repo dependency):
  - OAuth start, manual callback, poll-to-success, Escape and focus return to the launching tile.
  - Vertex upload controls disabled; switching keys on the same server clears the file and
    ignores the delayed old response.
  - Plugin quota discovery and correct v8 POST; zero remaining renders exhausted.
  - Config editing shows modified markers/save bar; all eight sections render against v8 YAML.
  - Source mode initializes CodeMirror; toolbar search and the native search shortcut find YAML
    matches after dependency cleanup.
  - 390px Korean config/OAuth in dark theme with reduced motion: no horizontal page overflow.
  - Dashboard, credentials, providers, plugins/store, logs and system route smoke checks:
    no page exceptions.
- Production `dist/index.html` browser smoke: login, hash routing and nine OAuth/import tiles;
  **zero external script, stylesheet, image or font requests**. Only `dist/index.html` is emitted.

Initial conflict-state tests/build failed as expected; subsequent failures exposed the missing
Korean keys, obsolete motion import and health/reset-time coupling. Those regressions are fixed
and covered. Early browser-driver retries corrected selectors/navigation in the temporary test
script, not application behavior. During the cleanup rerun, the temporary browser driver needed
a fresh Vite server to avoid stale HMR module instances when directly importing stores; its new
source-search check also initially targeted the wrong highlight selector for the custom toolbar.
Both checks passed after refreshing the server and correcting the driver; no application fix
was needed for those retries.

Browser calls used deterministic mock responses and synthetic credentials, not a live backend
or real provider OAuth accounts. Live authentication/import/quota integration remains unverified.
No push, deployment, real credential mutation, or backend code change was performed.

Local evidence (not committed): `/tmp/cloudproxyz-audit/` contains final command logs,
`browser-results.json`, browser drivers and desktop/mobile screenshots. Post-cleanup verification
is recorded in `verify-cleanup.log`, `browser-cleanup-final.log`, `production-cleanup.log`,
`knip-cleanup.json`, and the `dependency-audit-*-cleanup.log` files. The original mascot checksum
was checked again before handoff.
