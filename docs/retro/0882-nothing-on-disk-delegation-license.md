---
issue: 882
issue_title: "pi-permission-system: decide whether a chain link may dismiss an external_directory ask for a token that names nothing on disk (ADR 0007 §5)"
---

# Retro: #882 — decide whether a chain link may dismiss an external_directory ask for a token that names nothing on disk

## Stage: Planning (2026-10-17T04:03:25Z)

### Session summary

Deliberated the ADR 0007 §5 question with the operator and planned the amendment plus the checkpoint change.
The operator accepted the narrow bound: a link may `allow` a bash `external_directory` ask when every uncovered path names nothing on disk below the filesystem root and none is a proven write.
The plan has six steps: ADR §8, the normalizer probe and gate license, the wire, a fixture prep, the `feat!:` checkpoint change, and docs.

### Observations

- Gate decisions: bound = "unrooted, not a proven write" (rejected: leaf-absent, which admits `mkdir -p ~/new`; proven-read-and-absent, which relieves almost nothing because an undeclared tool is always `unproven`; rejection of the change outright).
  PR [#983]'s per-link `authorizerTrust` is named in the amendment as a different question and left parked on [#620] / [#799]; comment on it at ship time.
  Land now as `feat!:`, because it loosens the documented "caps any link's `allow` on `external_directory`" guarantee without a user edit.
- Measured against the local review log, with disposable scripts since deleted: 13 of 617 message-era bash ext-dir asks and 18 of 429 re-projected recent asks have every flagged path unrooted; all 31 are non-path tokens (`gh api` routes, slash commands, `git log -L` ranges, commit prose, regex).
  The recent 18 carried 18 `unproven` and 1 `core` effect.
  Post-#746 `waiting` entries carry no paths, so the recent set had to be re-projected through `BashProgram.parse` with an assumed cwd; existence is probed now, not at ask time.
- The issue attributed "the judge absorbs the surplus" to ADR 0013 §7; the sentence lives in ADR 0009's layering principle (restated in the architecture doc), with §7 narrowing the chain's role to judgment.
- PR [#684] was already closed by its author, so the issue's "close PR #684" step is moot.
- The allow-capable third-party `pi-permission-classifier` (0.5.2) skips the `path`/`external_directory` families itself, mirroring our cap, and `model-judge` never allows — so the change has no in-tree consumer on day one; the license is visible on `details.accessIntent` for a link to adopt.
- Design departure from the issue: the fact lives on `ForwardedAccessFacts` only, not also the `PromptPayload` request core; the audit line is a dedicated `authorizer_allow_licensed` record written by the envelope, which now takes the link name.
- Tidy-first assessor: accepted widening `delegation-envelope.test.ts` `makeDetails` as a prep step; folded the envelope signature change into the `feat!:` step (an unused parameter would trip lint).
  It flagged `ENOTDIR` handling (only `ENOENT` continues the walk) and the one exact-equality `accessIntent` assertion that breaks (`bash-external-directory.test.ts`, `cat /outside/a.ts`, because `/outside` is absent at `/`).
  Its claim that an optional field makes `toAccessFacts` a compile error is wrong; the plan says so.
- Unverified lead, not filed: a forwarded bash `external_directory` ask carries only the deciding path's `matchValues`, so the serving node resolves one path of possibly many; worth checking against [#1030]'s "every unit" fix before anyone files it.

## Stage: Implementation — TDD (2026-10-17T17:48:55Z)

### Session summary

All six planned steps landed (ADR amendment, the gate's license, the forwarding wire, the fixture prep, the `feat!:` envelope change, docs), then seven pre-completion review rounds reshaped what "names nothing on disk" means in code.
The pi-permission-system suite went from 6344 to 6413 tests (69 more).
The last round returned WARN, with nothing mis-licensed among the inputs it tried.

### Observations

- Plan deviation, found in step 2: a relative token after a non-literal `cd` is not literal-only as the plan assumed; `BashPathResolver.projectExternalPaths` resolves it against the cwd as a display guess.
  `BashExternalPath` gained a location mark (now `unlocated: "unknown-base" | "not-verbatim"`), carried through the dedup merge and `UncoveredExternalPath`, and the ADR condition was amended before step 2's commit.
- The plan's killing mutation "continue the walk on any `lstat` error" survived, correctly: the first existing ancestor still stops the walk, so the ENOENT-only rule is defensive, not reachable-distinct.
- The reviewer FAILed five times on invariant 1, each a new way the projected path differs from the word bash runs: the root itself (`rm -rf /`), glob and expansion spellings (`/e?c/passwd`), extglob truncated by error recovery (`/@(etc|var)` read as `/@`), backslash-newline, a failing literal `cd`, a lexical `..`, a word tree-sitter splits at a mid-word backtick or `<(`, a carriage return, form feed, or vertical tab, and (WARN) a backslash-escaped tab.
  After round 3 the operator replaced the exclusion list with a positive rule: the command must read verbatim (`BashProgram.readsVerbatim()`: no error recovery, no backslash-newline), and every flagged token must be a whole word, bounded in the source by an unescaped space, tab, newline, or `;&|<>`, and spelled verbatim as an absolute path with no expansion character and no dot segment.
  The operator decisions at each gate: fix with a resolver marker (round 1), require a whole parse (round 2), the verbatim-spelling rule (round 3), the whole-word adjacency check (round 4); round 5's boundary-set fix and round 6's escaped-boundary fix were applied as corrections within that rule.
- The fix commits are typed `refactor:` because the license is unreleased; the `feat!:` commit carries the changelog entry and the `BREAKING CHANGE:` footer.
- Accepted residuals recorded in ADR 0007 section 8: a new entry under the root, a whole-argument operand the projection never flags (`X=/etc; cat $X/passwd`, `~user/`, `$'...'`, `-f/x`, `dd if=`), and a trailing carriage return trimmed by `getNonEmptyString` before parsing.
- Measured with disposable vitest harnesses over the local review log: re-run through the shipped gate after each rule change, 8 of 430 recent bash `external_directory` asks still carry the license.
- Scripted doc edits with `String.prototype.replace` duplicated whole files when the replacement held `` $` `` (the "text before the match" pattern); switching to `split`/`join` fixed it.
  Twice an `Edit` carrying a section sign arrived as a form feed plus `foo`; the hooks caught both.
- Pre-completion reviewer: WARN (round 7), with only an awkward ADR sentence left, since fixed.
  Rounds 1 to 5 FAILed and round 6 WARNed as described above.

## Stage: Sync (worktree) (2026-10-17T22:39:51Z)

### Session summary

Pre-push `pnpm run lint` and `pnpm fallow dead-code` pass on the worktree.
The plan's `**Release:**` marker is "ship independently" and the behavior commit is `feat(pi-permission-system)!:`, so the root cuts a major for the package at ship time.
At ship time, also comment on PR [#983] that ADR 0007 amendment 8 decides only the narrow nothing-on-disk bound and the per-link trust map stays parked on [#620] and [#799]; [#684] was already closed by its author.

**Peer session transcript:** `/Users/chris/.pi/agent/sessions/--Users-chris-development-pi-pi-packages-worktrees-issue-882--/2026-10-17T03-36-48-260Z_01a147ef-0183-72af-8ae4-8b1623be9ed4.jsonl`, read with `read_session_file` for message-level verification at land and retro time.

### Observations

- No follow-up issues were filed.
  The unverified lead from planning (a forwarded bash `external_directory` ask carries only the deciding path's `matchValues`, so the serving node resolves one path of possibly many) was not checked against [#1030]'s "every unit" fix; the license is computed at the asking node over every uncovered path, so it does not depend on the answer.
- The `/retro` at the root should weigh the seven pre-completion review rounds: five FAILs on one invariant, each a new divergence between the projected token and the word bash runs, ended by replacing an exclusion list with a positive spelling rule.

[#620]: https://github.com/gotgenes/pi-packages/issues/620
[#684]: https://github.com/gotgenes/pi-packages/pull/684
[#799]: https://github.com/gotgenes/pi-packages/issues/799
[#983]: https://github.com/gotgenes/pi-packages/pull/983
[#1030]: https://github.com/gotgenes/pi-packages/issues/1030
