# Interface decisions

Applied `apple-design` for predictable native interaction, typography, keyboard use, readable contrast, and reduced motion; applied `design-taste-frontend` app-screen guidance for composition.

## Inventory and question

- Song Neighbors is a personal public project by Arhaan.
- The prepared catalog currently contains zero analyzed songs.
- There are no known track titles or artists to display yet.
- The planned input is one to five songs that fit the current mood.
- The planned output is up to twenty audio-similar titles and artists.
- Positive and negative feedback will stay within a session.
- The product has no playback, streaming login, or accounts.
- The Phase 0 visitor can inspect what is planned and visit the source repository.
- The main question is: can I find recommendations here yet?
- The answer is explicit: the catalog is not ready.

## Direction

The app draw selected **True-black flat**, seed **1484283753**, from the community/media kind, with a no-sidebar shell. No redraws. A true black ground and one lighter panel level carry the empty state. The app has no data hue because it has no analyzed data; the real zero remains neutral. The two adjacent record outlines in the original wordmark refer to the project's name.

The sheet's Inter font is deliberately replaced by the platform system font, following `apple-design` and the Phase 0 scope: no remote font request or font asset is needed to make an empty state usable. The screen uses native text sizing, an obvious focus ring, a skip link, and a `details` disclosure with immediate hover/press feedback. There are no entrance animations, timed effects, or gestures. All surfaces are opaque.

The layout is one centered 1100px column. Header, main panel, disclosure, and footer share the same edges. On phones the catalog count moves below the status text without dropping content. There are no fictional songs, artwork, previews, or availability promises. The Phase 0 state is explicitly static; runtime loading and the full working interface are later-phase work.

## Verification

Production viewport inspection is recorded by the coordinator in `docs/phases/phase-0.md`. The native disclosure is the only local interaction. No complete recommendation flow is claimed.

The next phases must transition the initial screen when the pointer becomes `ready`; the present screen is deliberately limited to the checked-in `not-ready` state. A zero displayed here describes the Phase 0 state, not an export-integrity check. An initial direct import from `public/catalog/current.json` caused Vite to warn about public-asset imports; it was removed in favor of this explicit static foundation state.

The development screenshot pass at 1440, 768, and 390 pixels showed readable content, equal outer margins, an honest zero, and no overflow. Source design lint passed with 0 failures and 0 warnings. The initial visual inspector reported `font-not-dealt` because of the documented system-font choice and `unused-canvas` because it treated the centered 1100px column as a sidebar layout. At 1440px the actual left and right margins are both 170px; the measured warning is not a visible imbalance. The final production inspection, including its explicit font allowance, is reported in the phase evidence.

App-screen critique: the unavailable state is readable immediately; all panel edges align; no status hue implies nonexistent data; zero is stated once; there are no charts or duplicated totals to reconcile; the phone retains every sentence and both real controls. The scope is intentionally a foundation state, so a full catalog interaction cannot be judged yet.

Final production inspection used `node <installed-design-taste-frontend-skill>/scripts/inspect.mjs --app http://127.0.0.1:4173/song-neighbors/ --allow font-not-dealt`: 0 failures, 1 `unused-canvas` warning, with the equal-margin explanation above. Every generated desktop/tablet/mobile fold and page screenshot was opened. The final screenshots have the corrected static sentence. In the in-app Chromium browser, a direct refresh retained the final production UI, Tab reached the skip link, Enter moved focus to main, the next Tab reached the disclosure, Enter expanded it, and Space collapsed it. At 320px, the collapsed and expanded views both had `scrollWidth === clientWidth === 320`. Console warning/error collection was empty. JavaScript, CSS, and the current pointer under `/song-neighbors/` each returned HTTP 200. The temporary viewport override was reset after testing.


## Phase 1 measured catalog status

Applied both design skills to the existing True-black flat direction (seed 1484283753), with no
redraw or layout/style migration. System typography and the native disclosure remain. The screen
answers whether a catalog exists: its largest figure now shows 500 actual analyzed songs; the
status names 169 artists and explicitly says discovery controls are still in development. A real
credits/license link makes the new public data attributable. There are no sample songs or counts.
The rejected music-checkpoint export was withdrawn; the final link selects the trained general
catalog only.

Before and final production inspections at 1440/768/390 px both had 0 failures and one
`unused-canvas` warning: the desktop frame actually has equal 170 px outer margins. Source lint
had 0 failures/warnings. System-font allowance is unchanged. Every final fold/page screenshot was
viewed; the [Phase 1 report](phases/phase-1.md) links saved desktop/tablet/mobile evidence.

App-screen critique: the preparation state and measured count answer the screen's question;
header/panel/disclosure/footer edges align; neutral color makes no quality claim; 500 songs and
169 artists are distinct labeled facts rather than duplicate totals; there are no fabricated zeros,
missing-data substitutions or chart legends; mobile preserves the complete status and credits link.
The three scope-relevant improvements are real counts, explicit discovery availability, and direct
attribution. The established composition has no newly visible defect requiring a redesign. The
500-track preparation gate is not a full recommendation-flow usability score.

Final Chromium verification on the built project subpath confirmed skip-link focus, keyboard
Enter/Space disclosure, expanded/collapsed 320 px views with scrollWidth/clientWidth both 320,
and an empty warning/error console. The final attribution path returned HTTP 200 with the exact
manifest hash. Temporary viewport overrides were reset. Screenshots show only the limited status
experience; no Phase 2/3 interaction is claimed.

## Phase 3 complete discovery interface

Both design skills were applied to the established **True-black flat**, seed **1484283753**,
system-font direction; no redraw or remote font. The screen now asks: which songs sit near
my current selection? Its own real objects supply the visual identity: the original paired
record wordmark, selected-song chips, and ranked titles/artists. There is no album artwork.

The 1100px no-sidebar frame holds a selector and wider results column, stacked below 880px.
The selector uses ordinary document flow so a long search plus five chips cannot hide its
action behind a sticky viewport. Search shows album/source IDs to distinguish recordings.
Three first-visit tracks resolve from actual loaded metadata. Counts derive from that metadata.
The single filled action is Recommend. Feedback is a separate labeled region with reset;
negative/positive preferences never masquerade as additional selected seeds.

Native controls, 44px touch targets, high-contrast focus, a skip link and live status announcements
support navigation. Keyboard focus moves to surviving headings when a card/chip disappears.
Only brief press feedback moves; reduced motion disables transitions so feedback is immediate. About/Catalog keeps attribution,
excerpt/model/coverage details out of the main selection flow. No images or generated assets
were needed, and no placeholders or fixture data enter the page.

Before inspection: 0 failures, 1 unused-canvas warning (equal 170px desktop margins were
misread as a sidebar). Final inspection: **0 failures, 0 warnings** at 1440/768/390px, with
the established system-font allowance. Source design lint: 0 failures/warnings. No measured
horizontal overflow or low contrast. Screenshots were opened and critiqued: controls and
titles align, hierarchy favors the task, seeds/preferences remain visibly separate, and
mobile retains full titles and actions. Initial empty right-column space is purposeful;
the actual results fill that region after Recommend. The source rank is data, not decoration.

Independent review reproduced an Escape → ArrowUp race: scrolling occurred before options
remounted, leaving the active option clipped. Post-render keyboard scrolling fixes it and
the browser regression checks active-row visibility. All four saved evidence images and
the exact fix were independently inspected. [Phase 3 report](phases/phase-3.md) records checks.

## Discovery redesign

The screen answers “which recordings sound like the songs I picked?” The interaction is the same before and after the redesign: search or select a real starting track, choose Recommend, then refine individual results. On a wide screen, source tracks sit beside their ranked neighbors; on a phone they appear in selection order. A link after the last result returns focus to the starting point.

The `design-taste-frontend` app draw selected **Accent ladder** (seed `412384280`, no redraws). The visual reference is a printed record sleeve: graphite ink on warm paper, with a vermilion accent for action and selection. The paired-record mark reappears in an original static SVG on the empty results panel. It makes no claim to depict any track’s album artwork. Once recommendations arrive, titles, artists and actual ranks replace the illustration. No font, image, audio or other third-party request was added.

The `apple-design` pass kept native keyboard controls, focus return, 44px touch targets and reduced-motion behavior. Track titles can wrap, the fifth selection is marked in both text and a five-slot indicator, and secondary details remain available through a native disclosure. The visual inspection at 1440, 768 and 390 pixels found no failures. The inspector’s paper-color and masthead-size warnings reflect two intentional choices: the canvas matches the sleeve stock, and the title fits one line at those widths with search visible. System text fonts are deliberate, so the UI works offline without shipping a font.

Independent before/after testing compared all 20 track IDs at each of four stages: one long-titled recording, that recording plus a second seed, positive feedback and negative feedback. All 80 positions matched the previous release. Enlarged text initially pushed the catalog counts outside the viewport; allowing the header and counts to wrap fixed it. Browser coverage now includes 200% text at 640, 390 and 320 CSS pixels, keyboard disclosure navigation, and returning from the end of the results.
