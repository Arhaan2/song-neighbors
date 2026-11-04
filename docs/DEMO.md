# Two-minute demo

Use the public [Song Neighbors site](https://arhaan2.github.io/song-neighbors/) or the verified production preview at `/song-neighbors/`. Start with a fresh page so feedback is empty.

1. **Introduce the scope.** “This compares real audio embeddings from a prepared catalog of 500 recordings. It returns titles and artists, with no playback or account connection. Similarity is not a promise that you will like a song.” Point to the catalog coverage and About/Catalog details.
2. **Search and choose one song.** Search `Spell`, select **Spell — Rolemusic** (`fma:045099`), and choose **Recommend**. Show the up-to-20 ranked list and the closest-selected-song explanation. The current single-seed product ranking starts with **Leafless Quince Tree — Rolemusic**; if a future catalog changes that, use its recorded evidence instead of promising fixed output.
3. **Combine seeds.** Search `Bedoin Song`, add **Bedoin Song — Lior** (`fma:003832`), and choose **Recommend** again. Explain that seed edits clear earlier results/refinement. Show that the new ordering combines both starting points. Selection supports up to five songs.
4. **Refine the moment.** Choose **More like this** on a recommendation, then **Not this mood** on another. Show the separate active-preference area, automatic reranking and removal of the feedback recordings from results. The seed chips remain unchanged.
5. **Reset and refresh.** Choose **Reset refinement** and show that the seed-only ordering returns. Refresh the page: selection and feedback clear because this is an in-memory session.
6. **Close with honest evaluation.** “The worker/data/browser checks have recorded release evidence. Human listening remains unmeasured.” Open the [listening worksheet](LISTENING_WORKSHEET.md) to show the independent “sounds similar” and “want to hear it now” questions.

For release verification, also search for an unsupported title, confirm the no-match message, check attribution, and compare the site's [build identity](https://arhaan2.github.io/song-neighbors/build-info.json) to the workflow commit. [Phase 4 evidence](phases/phase-4.md) records actual observations; this script does not itself establish a deployment pass.
