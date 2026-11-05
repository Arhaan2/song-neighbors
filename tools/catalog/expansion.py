"""Metadata-only cumulative FMA audit and reproducible expansion preparation.

No audio acquisition or inference is performed. The old small-subset command and its
selection order remain unchanged. All decisions are bound to the verified rc1 archive.
"""

from __future__ import annotations

import argparse
import ast
import copy
import csv
import io
import json
import re
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

import source
from catalog import canonical, sha

SUBSETS = {"small": {"small"}, "medium": {"small", "medium"}, "large": {"small", "medium", "large"}}
EXPECTED_COUNTS = {"small": 8000, "medium": 25000, "large": 106574}
REVIEW_VERSION = "fma-rc1-expanded-notice-review-v1"
SELECTION_VERSION = "fma-artist-first-genre-round-robin-v1"
# Additional review of exact rc1 album/artist/record notices. These do not affect
# the historical small audit. No reinterpretation of an ambiguous grant is needed.
ALBUM_EXCLUSIONS = {
    "7163": "album_notice_nc",
    "18571": "album_license_version_conflict",
    "21279": "unresolved_credit_in_title_request",
    "16384": "album_license_version_conflict",
}
ARTIST_EXCLUSIONS = {"22407": "artist_notice_audio_derivatives_restricted"}
PUBLISHED_RIGHTS_HOLDS = {"6674", "6675", "6677", "6679", "6680", "6684", "61011"}
TRACK_EXCLUSIONS = {
    **{
        tid: "unresolved_underlying_sample_or_text_grant"
        for tid in ("6674", "6675", "6676", "6677", "6679", "6680", "6683", "6684", "7824", "36716")
    },
    "61011": "unresolved_underlying_composition_grant",
    "61116": "unresolved_underlying_composition_grant",
    "121220": "underlying_composition_license_version_conflict",
    "121221": "underlying_composition_nc",
}
REVIEW_NOTES = {
    "artist:19164": (
        "Artist-wide BY 4.0 description conflicts with 26 per-record CC0 waivers. "
        "Chronology/precedence is not established; conservatively defer those waivers. "
        "Seventeen explicit BY 4.0 records remain eligible."
    ),
    "track:61011": (
        "Week Seven explicitly borrows the Vaselines Son of a Gun melody; underlying grant absent. "
        "One currently published recording is held from future selection."
    ),
    "track:61116": (
        "Week Twelve explicitly uses a melody from Yedikule; underlying composition identity/grant "
        "not established by the source. Conservative hold, not an infringement finding."
    ),
    "album:1883": (
        "Eight named recitation/sample/compilation tracks lack underlying grants: "
        "6674,6675,6676,6677,6679,6680,6683,6684. Six are already published and held "
        "out of future selection. Page-count percussion, bibliographic-count sounds, "
        "collaborative afterword and acknowledgments are outside these identified excerpts."
    ),
    "album:2124": (
        "w00t explicitly collages commercial game soundtrack fragments; underlying grants absent."
    ),
    "album:7474": (
        "Through A Glass Darkly explicitly samples film dialogue; underlying grant absent."
    ),
    "album:18833": (
        "Source explicitly describes factual scientific conversations for radio; defer new records."
    ),
    "album:21585": (
        "References to Robert Graves are uncertain context, not proof of unlicensed "
        "material; flag for review."
    ),
    "album:18212": (
        "Source describes submitted experimental sound files; flag uncertain sound "
        "collage, not nonmusical by default."
    ),
    "album:18571": (
        "Album source notice explicitly says BY 3.0; seven raw recording grants say BY 4.0. "
        "No separate biography/artwork scope established; exclude version conflict."
    ),
    "album:16384": (
        "Album prose explicitly says CC-BY-3.0, but sixteen recording URLs say BY 4.0. "
        "Conservatively exclude the unresolved version conflict."
    ),
    "album:7163": (
        "Album explicitly describes these recordings as BY-NC; record BY grant conflicts."
    ),
    "album:21279": (
        "Credit-in-title request remains unresolved; excluded as in Phase 1 album 22899."
    ),
    "artist:22407": (
        "Artist and album 21067 request No Audio Derivates and permission for reuse; excluded."
    ),
    "track:121220": (
        "Young Love underlying composition is BY 3.0; raw recording says BY 4.0. "
        "Exclude mixed-version ambiguity."
    ),
    "track:121221": (
        "When You Go underlying composition is BY-NC 3.0 US despite raw recording BY 4.0; excluded."
    ),
    "album:18400": (
        "Restrictions identify the two bonus covers by name; remaining ten original "
        "tracks retain their grants."
    ),
    "album:13141": (
        "Compilation explicitly marks The First Noel and Christmas Wish No. 3571 BY "
        "3.0; NC/ND/SA entries name other tracks."
    ),
    "album:19248": (
        "Cover image BY 3.0 applies to unshipped artwork; Bumbler sample credit is "
        "retained in track notices."
    ),
    "album:20180": "SA 2.0 applies explicitly to the unshipped photograph, not the recording.",
    "album:21144": "BY 2.0 applies explicitly to the unshipped cover image, not the recording.",
    "artist:19949": (
        "SA 3.0 scopes the quoted Music Manumit biography; do not copy it to the publication."
    ),
    "artist:20523": "NC-SA 3.0 scopes the sourced biography; do not copy it to the publication.",
    "artist:219": "BY 2.0 scopes the unshipped artist photo, not the recording.",
    "album:7503": (
        "Protected tracks 5,19,23 are stated to be absent from FMA; per-record grants "
        "still required."
    ),
    "album:7611": "Source states modern protected compositions were removed from this recording.",
    "album:12256": (
        "Walla collection explicitly describes actual crowds for sound effects; defer "
        "new records as likely nonmusical."
    ),
}
NOTICE_TERMS = re.compile(
    r"licen[sc]|copyright|permission|commercial|attribut|credit|rights reserved|"
    r"derivative|share.alike|creative commons|notify|notification|sampling|public domain",
    re.I,
)
LIKELY_NONMUSICAL_GENRES = {"Spoken", "Sound Effects"}
CREDIT_REVIEW_PATH = Path(__file__).with_name("notice_credits.json")
CREDIT_REVIEW = json.loads(CREDIT_REVIEW_PATH.read_text(encoding="utf-8"))
if CREDIT_REVIEW["metadataArchiveSha1"] != source.METADATA_SHA1:
    raise ValueError("Credit review belongs to another metadata archive")
CREDIT_EXCERPTS = CREDIT_REVIEW["albumCredits"]


def members_for(tracks: dict, subset: str) -> dict:
    """The CSV labels the *smallest* subset; larger archives include lower labels."""
    if subset not in SUBSETS:
        raise ValueError("Unknown cumulative subset")
    unknown = {t[("set", "subset")] for t in tracks.values()} - SUBSETS["large"]
    if unknown:
        raise ValueError(f"Unknown source subset labels: {sorted(unknown)}")
    return {tid: t for tid, t in tracks.items() if t[("set", "subset")] in SUBSETS[subset]}


def read_auxiliary(archive: Path) -> tuple[dict, dict, dict]:
    # Caller has verified the archive with source.read_members before reading aux tables.
    result = []
    with zipfile.ZipFile(archive) as z:
        for filename, key in (
            ("raw_albums.csv", "album_id"),
            ("raw_artists.csv", "artist_id"),
            ("genres.csv", "genre_id"),
        ):
            with z.open("fma_metadata/" + filename) as stream:
                result.append(
                    {
                        row[key]: row
                        for row in csv.DictReader(
                            io.TextIOWrapper(stream, encoding="utf-8", newline="")
                        )
                    }
                )
    return tuple(result)


def genre_data(track: dict, genres: dict) -> tuple[list[str], list[str], str]:
    ids = ast.literal_eval(track.get(("track", "genres_all"), "[]") or "[]")
    if not isinstance(ids, list) or any(str(i) not in genres for i in ids):
        raise ValueError("Invalid or unknown source genre IDs")
    ids = sorted({str(i) for i in ids}, key=int)
    names = sorted({genres[i]["title"] for i in ids})
    roots = sorted({genres[genres[i]["top_level"]]["title"] for i in ids})
    primary = track.get(("track", "genre_top"), "") or (roots[0] if roots else "Unknown")
    return ids, names, primary


def content_flags(genre_names: list[str], album_id: str) -> list[str]:
    flags = []
    if set(genre_names) & LIKELY_NONMUSICAL_GENRES:
        flags.append("likely_nonmusical_source_genre")
    if album_id == "18833":
        flags.append("likely_nonmusical_source_science_conversations")
    if album_id == "21585":
        flags.append("uncertain_source_literary_reference")
    if album_id == "18212":
        flags.append("uncertain_source_sound_collage")
    if album_id == "12256":
        flags.append("likely_nonmusical_source_crowd_collection")
    if "Field Recordings" in genre_names:
        flags.append("uncertain_field_recording_music_context")
    return flags


def extra_exclusion(tid: str, original: dict) -> str | None:
    if original.get("artist_id") == "19164" and "/zero/" in original.get("license_url", ""):
        return "artist_record_license_family_conflict"
    return (
        TRACK_EXCLUSIONS.get(tid)
        or ARTIST_EXCLUSIONS.get(original.get("artist_id"))
        or ALBUM_EXCLUSIONS.get(original.get("album_id"))
    )


def public_credit(record: dict, original: dict, album: dict, artist: dict) -> None:
    """Retain applicable source credits without copying unrelated biographies/artwork."""
    additions = []
    for key in ("album_producer", "album_engineer"):
        value = source.plain(album.get(key, ""))
        if value and value.lower() != "null":
            additions.append(f"{key}: {value}.")
    album_text = source.plain(album.get("album_information", ""))
    for excerpt in CREDIT_EXCERPTS.get(original.get("album_id"), []):
        if excerpt not in album_text:
            raise RuntimeError("Reviewed credit excerpt does not match verified source metadata")
        additions.append("Supplied album credits: " + excerpt)
    if "You may use this music for derivative works" in album_text:
        if not source.public_page(original.get("album_url", "")):
            raise ValueError("Missing requested album credit link")
        additions.append(
            "Source credit request retained: artist name, track title, and album link."
        )
    if original.get("album_id") == "22139":
        additions.append("Mise: http://misenation.com or http://soundcloud.com/misemusic.")
    if original.get("album_id") == "22692":
        additions.append(
            "'Love is Dying Ft. Fliss' written & composed by Nick Myer for AGENDA "
            "23. Female vocoda voice + rap: C. Female chorus voice: Fliss."
        )
    if original.get("artist_id") == "15380":
        additions.append(
            "Words by A. Jones, performance by R. Gold. Please credit to: A.Jones/OBF."
        )
    if original.get("artist_id") == "20705":
        additions.append("Three Chain Links: http://threechainlinks.com.")
    if original.get("artist_id") == "20519":
        additions.append("Artist requests credit as Doctor Turtle, not Dr Turtle.")
    if original.get("artist_id") == "20332":
        additions.append('Artist requests attribution as "Jim Rooster".')
    if original.get("artist_id") == "20985":
        additions.append("Music credited by song name and Andy G. Cohen; https://andyg.co/hen.")
    attribution = record["provenance"]["recordingLicense"]["attribution"]
    additions = [notice for notice in additions if notice not in attribution]
    if additions:
        record["provenance"]["recordingLicense"]["attribution"] += " " + " ".join(additions)


def evidence_for(tid: str, track: dict, raw: dict | None, albums: dict, artists: dict) -> dict:
    raw = raw or {}
    album = albums.get(raw.get("album_id"), {})
    artist = artists.get(raw.get("artist_id"), {})
    # Exact source strings, not rewritten legal summaries. No contact/location fields.
    return {
        "sourceRecordId": tid,
        "subsetLabel": track[("set", "subset")],
        "track": {
            key: raw.get(key, "")
            for key in (
                "track_title",
                "track_url",
                "artist_id",
                "artist_name",
                "album_id",
                "album_title",
                "album_url",
                "license_title",
                "license_url",
                "track_copyright_c",
                "track_copyright_p",
                "track_composer",
                "track_lyricist",
                "track_publisher",
                "track_information",
            )
        },
        "album": {
            key: album.get(key, "")
            for key in (
                "album_id",
                "album_title",
                "album_information",
                "album_producer",
                "album_engineer",
            )
        },
        "artist": {key: artist.get(key, "") for key in ("artist_id", "artist_name", "artist_bio")},
        "genresAll": track.get(("track", "genres_all"), ""),
        "genreTop": track.get(("track", "genre_top"), ""),
    }


def retained_published(
    published_ids: set[str], record_ids: set[str], exclusions: dict
) -> tuple[set[str], dict]:
    missing = published_ids - record_ids
    permitted_holds = {f"fma:{int(tid):06d}" for tid in PUBLISHED_RIGHTS_HOLDS}
    if missing - permitted_holds:
        raise ValueError(
            "Published records unexpectedly fail expanded policy: "
            f"{sorted(missing - permitted_holds)}"
        )
    holds = {ident: exclusions[ident] for ident in sorted(missing)}
    return published_ids & record_ids, holds


def select_candidates(
    candidates: list[dict], published_ids: set[str], target: int, cap: int
) -> list[dict]:
    """Preserve published IDs; least represented artists first, then genre, album, ID.

    A global source-artist cap includes all genres. Existing rows are grandfathered
    if already above the cap. Source IDs (not display names) define the artist key.
    """
    if target < len(published_ids) or cap < 1:
        raise ValueError("Target cannot drop published recordings; cap must be positive")
    by_id = {r["id"]: r for r in candidates}
    if len(by_id) != len(candidates) or not published_ids <= by_id.keys():
        raise ValueError("Duplicate candidates or published recording no longer eligible")
    selected = [by_id[tid] for tid in sorted(published_ids)]
    counts = Counter(r["artistId"] for r in selected)
    by_artist = defaultdict(list)
    for item in candidates:
        if item["id"] not in published_ids and not any(
            f.startswith("likely_nonmusical_") for f in item["contentFlags"]
        ):
            by_artist[item["artistId"]].append(item)
    # Genre/album interleaving makes ascending track order less album-concentrated.
    queues = {}
    for artist, items in by_artist.items():
        groups = defaultdict(list)
        for item in items:
            groups[(item["primaryGenre"], item["albumId"])].append(item)
        groups = {key: sorted(rows, key=lambda r: r["id"]) for key, rows in sorted(groups.items())}
        queue = []
        while groups:
            for key in list(groups):
                queue.append(groups[key].pop(0))
                if not groups[key]:
                    del groups[key]
        queues[artist] = queue
    genre_counts = Counter(r["primaryGenre"] for r in selected)
    while queues and len(selected) < target:
        available = [a for a in queues if counts[a] < cap]
        if not available:
            break
        artist = min(
            available,
            key=lambda a: (
                counts[a],
                genre_counts[queues[a][0]["primaryGenre"]],
                queues[a][0]["primaryGenre"],
                int(a),
            ),
        )
        item = queues[artist].pop(0)
        selected.append(item)
        counts[artist] += 1
        genre_counts[item["primaryGenre"]] += 1
        if not queues[artist]:
            del queues[artist]
    return sorted(selected, key=lambda r: r["id"])


def summary(items: list[dict]) -> dict:
    artists = Counter(r["artistId"] for r in items)
    names = {r["artistId"]: r["artist"] for r in items}
    genres = Counter(r["primaryGenre"] for r in items)
    top = sorted(artists.items(), key=lambda item: (-item[1], int(item[0])))[:10]
    return {
        "count": len(items),
        "artistIdCount": len(artists),
        "artistDisplayNameCount": len({r["artist"] for r in items}),
        "primaryGenreCounts": dict(sorted(genres.items())),
        "allGenreTagCounts": dict(
            sorted(Counter(g for r in items for g in r["genreNames"]).items())
        ),
        "missingMetadata": {
            "genreTop": sum(not r["sourceGenreTop"] for r in items),
            "genreTags": sum(not r["genreIds"] for r in items),
            "albumTitle": sum(not r["hasAlbum"] for r in items),
        },
        "contentFlagCounts": dict(
            sorted(Counter(f for r in items for f in r["contentFlags"]).items())
        ),
        "largestArtistCount": max(artists.values(), default=0),
        "topTenArtistShare": round(sum(n for _, n in top) / len(items), 6) if items else 0,
        "topArtists": [{"artistId": aid, "artist": names[aid], "count": n} for aid, n in top],
    }


def active_catalog(catalog_root: Path) -> tuple[dict, list[dict], dict]:
    pointer = json.loads((catalog_root / "current.json").read_text())
    if pointer.get("status") != "ready":
        raise ValueError("Published catalog must be ready")
    directory = catalog_root / pointer["catalogVersion"]
    manifest_path = directory / "manifest.json"
    if source.digest(manifest_path) != pointer["manifestSha256"]:
        raise ValueError("Active manifest hash mismatch")
    manifest = json.loads(manifest_path.read_text())
    tracks_path = directory / manifest["files"]["tracks"]["path"]
    if source.digest(tracks_path) != manifest["files"]["tracks"]["sha256"]:
        raise ValueError("Active metadata hash mismatch")
    tracks = json.loads(tracks_path.read_text())
    if len(tracks) != manifest["trackCount"] or len({r["id"] for r in tracks}) != len(tracks):
        raise ValueError("Active track count or IDs mismatch")
    identity = {
        "catalogVersion": pointer["catalogVersion"],
        "manifestSha256": pointer["manifestSha256"],
        "trackCount": manifest["trackCount"],
        "tracksSha256": manifest["files"]["tracks"]["sha256"],
    }
    return manifest, tracks, identity


def audit(
    archive: Path, catalog_root: Path, subset: str = "large", target: int = 5000, cap: int = 50
) -> tuple[dict, dict, dict, dict]:
    tracks, raw = source.read_members(archive)
    albums, artists, genres = read_auxiliary(archive)
    for name, expected in EXPECTED_COUNTS.items():
        if len(members_for(tracks, name)) != expected:
            raise ValueError(f"Unexpected cumulative {name} membership")
    active, published, identity = active_catalog(catalog_root)
    published_ids = {r["id"] for r in published}
    published_by_id = {r["id"]: r for r in published}
    eligible, records, evidence, exclusions, legacy = [], {}, {}, {}, Counter()
    notice_screen = {"albumIds": set(), "artistIds": set()}
    for tid, track in sorted(tracks.items(), key=lambda item: int(item[0])):
        ident = f"fma:{int(tid):06d}"
        original = raw.get(tid)
        item_evidence = evidence_for(tid, track, original, albums, artists)
        record, reason = source.record_for(tid, track, original)
        if record:
            legacy[track[("set", "subset")]] += 1
            reason = extra_exclusion(tid, original)
            if not reason:
                try:
                    public_credit(
                        record,
                        original,
                        albums.get(original.get("album_id"), {}),
                        artists.get(original.get("artist_id"), {}),
                    )
                except ValueError:
                    reason = "missing_required_album_credit"
            if reason:
                record = None
        if not record:
            exclusions[ident] = reason
            continue
        if track[("artist", "id")] != original["artist_id"]:
            raise ValueError(f"Processed/raw artist mismatch: {ident}")
        genre_ids, names, primary = genre_data(track, genres)
        item = {
            "id": ident,
            "artistId": original["artist_id"],
            "artist": record["artist"],
            "albumId": original["album_id"],
            "subsetLabel": track[("set", "subset")],
            "sourceGenreTop": track.get(("track", "genre_top"), ""),
            "primaryGenre": primary,
            "genreIds": genre_ids,
            "genreNames": names,
            "hasAlbum": bool(record.get("album")),
            "contentFlags": content_flags(names, original["album_id"]),
            "evidenceSha256": sha(canonical(item_evidence)),
        }
        eligible.append(item)
        evidence[ident] = item_evidence
        if ident in published_by_id:
            old = published_by_id[ident]
            # Keep published identity and provenance; supplement attribution from audited notices.
            record = {
                key: copy.deepcopy(old[key])
                for key in ("id", "title", "artist", "album", "provenance")
                if key in old
            }
            record["audioPath"] = f"{int(tid):06d}"[:3] + f"/{int(tid):06d}.mp3"
            public_credit(
                record,
                original,
                albums.get(original.get("album_id"), {}),
                artists.get(original.get("artist_id"), {}),
            )
        else:
            record["provenance"]["datasetId"] = "fma-" + track[("set", "subset")]
        records[ident] = record
        for kind, key, field in (
            ("album", "album_id", "album_information"),
            ("artist", "artist_id", "artist_bio"),
        ):
            if NOTICE_TERMS.search(source.plain(item_evidence[kind][field])):
                notice_screen[kind + "Ids"].add(original[key])
    retained_ids, published_holds = retained_published(published_ids, set(records), exclusions)
    pools, reports = {}, {}
    for name in SUBSETS:
        ids = {f"fma:{int(tid):06d}" for tid in members_for(tracks, name)}
        pool = [r for r in eligible if r["id"] in ids]
        additions = [r for r in pool if r["id"] not in published_ids]
        pools[name] = pool
        reports[name] = {
            "metadataRecordsConsidered": len(ids),
            "legacyPolicyEligibleCount": sum(
                n for label, n in legacy.items() if label in SUBSETS[name]
            ),
            "eligible": summary(pool),
            "alreadyPublishedCount": len(ids & published_ids),
            "eligiblePublishedCount": len(ids & retained_ids),
            "potentialAdditions": summary(additions),
            "exclusionCounts": dict(
                sorted(
                    Counter(reason for ident, reason in exclusions.items() if ident in ids).items()
                )
            ),
            "newAudioStages": {
                stage: "not assessed by metadata audit; requires separate audio-stage evidence"
                for stage in (
                    "availability",
                    "archiveIntegrity",
                    "decoding",
                    "inference",
                    "deduplication",
                    "publication",
                )
            },
        }
    chosen = select_candidates(pools[subset], retained_ids, target, cap)
    chosen_ids = {r["id"] for r in chosen}
    new_ids = chosen_ids - published_ids
    metadata = {
        "archiveSha1": source.METADATA_SHA1,
        "archiveSha256": source.digest(archive),
        "datasetVersion": source.DATASET_VERSION,
    }
    policy = {
        "version": source.POLICY_VERSION,
        "expandedReviewVersion": REVIEW_VERSION,
        "exclusionCounts": reports[subset]["exclusionCounts"],
    }
    source_description = {
        "datasetVersion": source.DATASET_VERSION,
        "sourceUrl": source.SOURCE,
        "metadataLicense": copy.deepcopy(active["sources"][0]["metadataLicense"]),
        "termsUrls": copy.deepcopy(active["sources"][0]["termsUrls"]),
    }
    selection = {
        "schemaVersion": 1,
        "sources": [
            {"datasetId": "fma-" + label, **source_description}
            for label in SUBSETS
            if label in SUBSETS[subset]
        ],
        "metadata": metadata,
        "policy": policy,
        "records": [records[r["id"]] for r in chosen],
    }
    manifest = {
        "schemaVersion": 1,
        "kind": "metadata-candidate-selection-not-analyzed-catalog",
        "metadata": metadata,
        "activeCatalog": identity,
        "sourceSubset": subset,
        "sourcePolicy": policy,
        "creditReviewSha256": source.digest(CREDIT_REVIEW_PATH),
        "selectionPolicy": {
            "version": SELECTION_VERSION,
            "targetTotal": target,
            "sourceArtistCap": cap,
            "preserveEligiblePublishedIds": True,
            "heldPublishedIds": sorted(published_holds),
            "order": (
                "Least represented source artist first; next genre's selected count, "
                "genre name, numeric artist ID. Within artist, round robin sorted "
                "genre/album groups then stable recording ID. Export order stable ID."
            ),
            "content": (
                "Defer new source Spoken/Sound Effects and album 12256 crowd "
                "recordings; retain published IDs. Field Recordings flag uncertain, not "
                "excluded. Instrumental, ambient and experimental music remain "
                "eligible."
            ),
        },
        "preservedEligiblePublishedCount": len(retained_ids),
        "heldPublishedCount": len(published_holds),
        "publishedIdsNeedingReview": published_holds,
        "selectedTotal": len(chosen),
        "newCandidateCount": len(new_ids),
        "planningShortfall": max(0, target - len(chosen)),
        "materializedSelectionSha256": sha(canonical(selection) + b"\n"),
        "records": [
            {
                key: r[key]
                for key in ("id", "artistId", "subsetLabel", "contentFlags", "evidenceSha256")
            }
            for r in chosen
        ],
    }
    report = {
        "schemaVersion": 1,
        "metadata": metadata,
        "activeCatalog": identity,
        "publishedIdsNeedingReview": published_holds,
        "totalMetadataRecords": len(tracks),
        "subsetLabelCounts": dict(Counter(t[("set", "subset")] for t in tracks.values())),
        "cumulativeSubsets": reports,
        "noticeReview": {
            "version": REVIEW_VERSION,
            "method": (
                "Existing exact per-track grant and notice policy plus immutable "
                "album/artist/record adjudications. Lexical screening is an aid, not "
                "exhaustive legal clearance."
            ),
            "screenedEligibleNoticeIds": {k: sorted(v, key=int) for k, v in notice_screen.items()},
            "decisions": REVIEW_NOTES,
        },
        "selection": {
            "sourceSubset": subset,
            "preservedEligiblePublishedCount": len(retained_ids),
            "heldPublishedCount": len(published_holds),
            "targetTotal": target,
            "artistCap": cap,
            "selected": summary(chosen),
            "newCandidates": summary([r for r in chosen if r["id"] in new_ids]),
            "shortfall": max(0, target - len(chosen)),
            "eligibleNotSelected": len(pools[subset]) - len(chosen),
            "newCandidatesDeferredForLikelyNonmusicalContent": sum(
                any(f.startswith("likely_nonmusical_") for f in r["contentFlags"])
                and r["id"] not in published_ids
                for r in pools[subset]
            ),
        },
        "exclusionIdsByReason": {
            reason: sorted(ident for ident, why in exclusions.items() if why == reason)
            for reason in sorted(set(exclusions.values()))
        },
        "selectionManifestSha256": sha(canonical(manifest) + b"\n"),
    }
    local_evidence = {
        "metadata": metadata,
        "noticeReview": REVIEW_NOTES,
        "eligibleRecords": evidence,
        "exclusions": [
            {
                "id": ident,
                "reason": why,
                "evidence": evidence_for(
                    str(int(ident[4:])),
                    tracks[str(int(ident[4:]))],
                    raw.get(str(int(ident[4:]))),
                    albums,
                    artists,
                ),
            }
            for ident, why in exclusions.items()
        ],
    }
    return manifest, report, selection, local_evidence


def write(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_bytes(canonical(value) + b"\n")
    temporary.replace(path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["audit", "materialize"])
    parser.add_argument("--metadata-archive", type=Path, required=True)
    parser.add_argument("--catalog-root", type=Path, default=Path("public/catalog"))
    parser.add_argument("--subset", choices=list(SUBSETS), default="large")
    parser.add_argument("--target-total", type=int, default=5000)
    parser.add_argument("--artist-cap", type=int, default=50)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--selection", type=Path, required=True)
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--additions-selection", type=Path)
    args = parser.parse_args()
    if args.command == "materialize":
        expected = json.loads(args.manifest.read_text())
        args.subset = expected["sourceSubset"]
        args.target_total = expected["selectionPolicy"]["targetTotal"]
        args.artist_cap = expected["selectionPolicy"]["sourceArtistCap"]
    manifest, report, selection, evidence = audit(
        args.metadata_archive, args.catalog_root, args.subset, args.target_total, args.artist_cap
    )
    if args.command == "materialize":
        if canonical(manifest) != canonical(expected):
            raise ValueError(
                "Candidate manifest no longer reproduces exactly; review before acquisition"
            )
    else:
        if args.report is None:
            parser.error("audit requires --report")
        write(args.manifest, manifest)
        write(args.report, report)
    write(args.selection, selection)
    if args.additions_selection:
        published_ids = {r["id"] for r in active_catalog(args.catalog_root)[1]}
        additions = {
            **selection,
            "records": [r for r in selection["records"] if r["id"] not in published_ids],
        }
        write(args.additions_selection, additions)
    write(args.evidence, evidence)
    print(
        json.dumps(
            {
                "sourceSubset": args.subset,
                "selectedTotal": manifest["selectedTotal"],
                "newCandidateCount": manifest["newCandidateCount"],
                "planningShortfall": manifest["planningShortfall"],
                "selectionSha256": source.digest(args.selection),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
