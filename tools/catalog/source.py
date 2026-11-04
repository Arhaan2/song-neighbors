"""Reproducible FMA-small acquisition and per-record rights selection (standard library)."""

from __future__ import annotations

import argparse
import csv
import hashlib
import html
import io
import json
import re
import shutil
import subprocess
import zipfile
from collections import Counter, defaultdict, deque
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

METADATA_SHA1 = "f0df49ffe5f2a6008d7dc83c6915b31835dfe733"
SMALL_SHA1 = "ade154f733639d52e35e32f5593efe5be76c6d70"
DATASET_VERSION = "2017-05-09-rc1"
POLICY_VERSION = "fma-explicit-cc0-by-v1"
SOURCE = "https://github.com/mdeff/fma"
BASE = "https://os.unil.cloud.switch.ch/fma/"
# Manual review is bound to METADATA_SHA1, never applied to a mutable live source.
# Conflicting/unclear album or artist terms are conservative exclusions, not legal findings.
REVIEWED_ALBUM_EXCLUSIONS = {
    "6467": "album_notice_nc",
    "21277": "album_license_version_conflict",
    "9016": "unresolved_source_notification_request",
    "22899": "unresolved_credit_in_title_request",
}
REVIEWED_ARTIST_EXCLUSIONS = {
    "21128": "artist_notice_noncommercial",
    "19498": "artist_requests_project_permission",
    "2008": "artist_commercial_terms_ambiguous",
}
ALBUM_LINK_CREDITS = {
    "21088",
    "21112",
    "21295",
    "21296",
    "21299",
    "21808",
    "22283",
    "22293",
    "22333",
    "22342",
}
ALLOWLIST = {
    f"https://creativecommons.org/licenses/by/{version}/"
    for version in ("1.0", "2.0", "2.5", "3.0", "4.0")
} | {"https://creativecommons.org/publicdomain/zero/1.0/"}


def digest(path: Path, algorithm: str = "sha256") -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, algorithm).hexdigest()


def verify_archive(path: Path, expected: str) -> None:
    actual = digest(path, "sha1")
    if actual != expected:
        raise ValueError(f"Archive SHA-1 mismatch: expected {expected}, received {actual}")


def canonical_license(value: str) -> str | None:
    """Map only explicit source URLs; no version inference or loose substring matching."""
    url = urlsplit(value.strip())
    if (
        url.scheme not in {"http", "https"}
        or url.netloc not in {"creativecommons.org", "www.creativecommons.org"}
        or url.query
        or url.fragment
    ):
        return None
    canonical = "https://creativecommons.org" + url.path.rstrip("/") + "/"
    return canonical if canonical in ALLOWLIST else None


def public_page(value: str) -> str | None:
    url = urlsplit(value.strip())
    if (
        url.scheme not in {"http", "https"}
        or url.netloc not in {"freemusicarchive.org", "www.freemusicarchive.org"}
        or not url.path.startswith("/music/")
        or url.query
        or url.fragment
    ):
        return None
    return urlunsplit(("https", url.netloc, url.path, "", ""))


def plain(value: str) -> str:
    # Preserve supplied HTML link destinations as text before removing formatting.
    value = re.sub(
        r"<a\b[^>]*href=[\"\']([^\"\']+)[\"\'][^>]*>(.*?)</a>", r"\2 (\1)", value, flags=re.I | re.S
    )
    return " ".join(html.unescape(re.sub(r"<[^>]*>", " ", value)).split())


def read_members(archive: Path) -> tuple[dict[str, dict], dict[str, dict]]:
    verify_archive(archive, METADATA_SHA1)
    with zipfile.ZipFile(archive) as z:
        with z.open("fma_metadata/tracks.csv") as raw:
            reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8", newline=""))
            groups, names = next(reader), next(reader)
            next(reader)  # the third header row names the track_id index
            keys = list(zip(groups, names, strict=True))
            tracks = {row[0]: dict(zip(keys, row, strict=True)) for row in reader}
        with z.open("fma_metadata/raw_tracks.csv") as raw:
            reader = csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8", newline=""))
            index = reader.fieldnames[0]
            originals = {row[index]: row for row in reader}
    return tracks, originals


def notice_fields(original: dict) -> dict[str, str]:
    keys = (
        "track_copyright_c",
        "track_copyright_p",
        "track_composer",
        "track_lyricist",
        "track_publisher",
        "track_information",
    )
    return {
        key: plain(original[key])
        for key in keys
        if original.get(key, "").strip().lower() not in {"", "null"}
    }


def notice_conflict(notices: dict[str, str], license_url: str) -> str | None:
    text = " ".join(notices.values())
    if re.search(
        r"(?i)by-(?:nc|nd|sa)|nc-sa|non.?commercial|no.?deriv|share.?alike|all rights reserved",
        text,
    ):
        return "conflicting_restricted_notice"
    for match in re.finditer(
        r"https?://(?:www\.)?creativecommons\.org/(licenses|publicdomain)/([a-z0-9+-]+)/([0-9.]+)/",
        text,
    ):
        identity = "https://creativecommons.org/" + "/".join(match.groups()) + "/"
        if identity != license_url:
            return "ambiguous_composite_license"
    return None


def record_for(track_id: str, track: dict, original: dict | None) -> tuple[dict | None, str]:
    if original is None:
        return None, "missing_raw_record"
    raw_license = original.get("license_url", "")
    license_url = canonical_license(raw_license)
    if license_url is None:
        reason = (
            "excluded_nc_nd_sa"
            if re.search(r"by-(?:nc|nd|sa)", raw_license)
            else "unmapped_or_missing_license"
        )
        return None, reason
    statement = original.get("license_title", "").strip()
    normalized = re.sub(r"[^a-z0-9]", "", statement.lower())
    stated_versions = re.findall(r"\b[1-4]\.[0-9]\b", statement)
    allowed_family = "cc0" in normalized if "/zero/" in license_url else "attribution" in normalized
    if (
        not allowed_family
        or any(
            word in normalized
            for word in ("noncommercial", "noderiv", "sharealike", "sampling", "allrightsreserved")
        )
        or any(f"/{version}/" not in license_url for version in stated_versions)
    ):
        return None, "conflicting_license_evidence"
    album_id = original.get("album_id", "")
    artist_id = original.get("artist_id", "")
    if reason := REVIEWED_ALBUM_EXCLUSIONS.get(album_id):
        return None, reason
    if reason := REVIEWED_ARTIST_EXCLUSIONS.get(artist_id):
        return None, reason
    notices = notice_fields(original)
    if conflict := notice_conflict(notices, license_url):
        return None, conflict
    source_page = public_page(original.get("track_url", ""))
    if source_page is None:
        return None, "missing_or_invalid_source_page"
    title = plain(original.get("track_title", ""))
    artist = plain(original.get("artist_name", ""))
    statement = original.get("license_title", "").strip()
    if not all((title, artist, statement)):
        return None, "missing_title_artist_or_license_statement"
    attribution = (
        f"{title} — {artist}. Source: {source_page}. License: {statement} ({license_url})."
    )
    album_url = public_page(original.get("album_url", ""))
    if album_url:
        attribution += f" Album source: {album_url}."
    if album_id in ALBUM_LINK_CREDITS:
        if not album_url:
            return None, "missing_required_album_credit"
        attribution += " Source credit request retained: artist name, track title, and album link."
    if album_id == "13303":
        attribution += " Producer: Tricky Diesel. Source requests credit as the producer."
    for key, notice in notices.items():
        attribution += f" {key}: {notice}."
    attribution += (
        " Available FMA excerpt transformed into numerical audio embeddings; "
        "no endorsement implied."
    )
    tid = f"{int(track_id):06d}"
    record = {
        "id": f"fma:{tid}",
        "title": title,
        "artist": artist,
        "provenance": {
            "datasetId": "fma-small",
            "datasetVersion": DATASET_VERSION,
            "sourceRecordId": track_id,
            "sourcePage": source_page,
            "recordingLicense": {
                "statement": statement,
                "url": license_url,
                "attribution": attribution,
            },
            "publicationBasis": (
                "Explicit per-record license_url in checksum-verified FMA raw_tracks.csv: "
                f"{raw_license}. The CC0 waiver or CC BY grant permits transformation and sharing; "
                "creator, title, supplied copyright/contributor notices, source and exact license "
                "are retained, and the excerpt-to-embedding change is disclosed. "
                "FMA metadata separately CC BY 4.0. FMA describes its dataset as "
                "intended for research; this stated intent is retained. The publication basis "
                "is the explicit recording grant, not a research exception or absent raw audio."
            ),
        },
        "audioPath": f"{tid[:3]}/{tid}.mp3",
    }
    album = plain(original.get("album_title", ""))
    if album:
        record["album"] = album
    return record, "eligible"


def diverse_selection(eligible: list[tuple[dict, str, str]], limit: int) -> list[dict]:
    """Round-robin genres and artists, then their ascending IDs. No random state."""
    grouped = defaultdict(lambda: defaultdict(list))
    for record, artist_id, genre in eligible:
        grouped[genre][artist_id].append(record)
    genres = {}
    for genre in sorted(grouped):
        genres[genre] = deque(
            deque(sorted(records, key=lambda r: r["id"]))
            for _, records in sorted(grouped[genre].items())
        )
    selected = []
    while genres and len(selected) < limit:
        for genre in list(genres):
            artists = genres[genre]
            tracks = artists.popleft()
            selected.append(tracks.popleft())
            if tracks:
                artists.append(tracks)
            if not artists:
                del genres[genre]
            if len(selected) == limit:
                break
    return selected


def inspect_metadata(archive: Path, limit: int) -> tuple[dict, dict]:
    tracks, originals = read_members(archive)
    subset_counts = Counter(t[("set", "subset")] for t in tracks.values())
    small = {tid: t for tid, t in tracks.items() if t[("set", "subset")] == "small"}
    if len(small) != 8000:
        raise ValueError(f"Expected 8000 FMA-small membership IDs, found {len(small)}")
    eligible, exclusions = [], []
    titles, urls = Counter(), Counter()
    for tid, track in sorted(small.items(), key=lambda item: int(item[0])):
        raw = originals.get(tid)
        titles[raw.get("license_title", "") if raw else "missing"] += 1
        urls[raw.get("license_url", "") if raw else "missing"] += 1
        record, reason = record_for(tid, track, raw)
        if record:
            eligible.append((record, track[("artist", "id")], track[("track", "genre_top")]))
        else:
            exclusions.append({"id": f"fma:{int(tid):06d}", "reason": reason})
    selected = diverse_selection(eligible, limit)
    selected_ids = {r["id"] for r in selected}
    exclusion_counts = dict(Counter(r["reason"] for r in exclusions))
    selection = {
        "schemaVersion": 1,
        "sources": [
            {
                "datasetId": "fma-small",
                "datasetVersion": DATASET_VERSION,
                "sourceUrl": SOURCE,
                "metadataLicense": {
                    "statement": "Creative Commons Attribution 4.0 International",
                    "url": "https://creativecommons.org/licenses/by/4.0/",
                    "attribution": (
                        "FMA: A Dataset for Music Analysis — Michaël Defferrard, Kirell Benzi, "
                        "Pierre Vandergheynst and Xavier Bresson (ISMIR 2017). "
                        "Metadata selected and normalized."
                    ),
                },
                "termsUrls": [
                    SOURCE + "#acknowledgments-and-licenses",
                    "https://creativecommons.org/licenses/by/4.0/",
                ],
            }
        ],
        "metadata": {
            "archiveSha256": digest(archive),
            "archiveSha1": METADATA_SHA1,
            "datasetVersion": DATASET_VERSION,
        },
        "policy": {"version": POLICY_VERSION, "exclusionCounts": exclusion_counts},
        "records": selected,
    }
    report = {
        "schemaVersion": 1,
        "datasetVersion": DATASET_VERSION,
        "policyVersion": POLICY_VERSION,
        "metadataArchiveSha1": METADATA_SHA1,
        "metadataArchiveSha256": selection["metadata"]["archiveSha256"],
        "totalMetadataRecords": len(tracks),
        "subsetLabelCounts": dict(subset_counts),
        "smallSubsetCount": len(small),
        "licenseTitleCounts": dict(titles),
        "licenseUrlCounts": dict(urls),
        "eligibleCount": len(eligible),
        "eligibleArtistNameCount": len({r["artist"] for r, _, _ in eligible}),
        "eligibleArtistCount": len({a for _, a, _ in eligible}),
        "eligibleGenreCounts": dict(Counter(g for _, _, g in eligible)),
        "selectedCount": len(selected),
        "selectedArtistNameCount": len({r["artist"] for r in selected}),
        "selectedArtistCount": len({a for r, a, _ in eligible if r["id"] in selected_ids}),
        "selectedGenreCounts": dict(Counter(g for r, _, g in eligible if r["id"] in selected_ids)),
        "selectionPolicy": (
            "Round robin sorted genre, artist ID, stable track ID; deterministic limit"
        ),
        "eligibleNotSelectedCount": len(eligible) - len(selected),
        "eligibleIds": [r["id"] for r, _, _ in eligible],
        "selectedIds": [r["id"] for r in selected],
        "exclusionCounts": exclusion_counts,
        "exclusions": exclusions,
    }
    return selection, report


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(path)


def download(kind: str, cache: Path) -> None:
    cache.mkdir(parents=True, exist_ok=True)
    name = "fma_metadata.zip" if kind == "metadata" else "fma_small.zip"
    expected = METADATA_SHA1 if kind == "metadata" else SMALL_SHA1
    target = cache / name
    if target.exists():
        verify_archive(target, expected)
        print(json.dumps({"file": name, "reused": True, "sha256": digest(target)}))
        return
    partial = cache / (name + ".part")
    required = 500_000_000 if kind == "metadata" else 9_000_000_000
    remaining = required - (partial.stat().st_size if partial.exists() else 0)
    if shutil.disk_usage(cache).free < max(remaining, 0) + 2_000_000_000:
        raise ValueError("Insufficient free disk space (including 2GB reserve)")
    subprocess.run(
        [
            "curl",
            "--fail",
            "--location",
            "--continue-at",
            "-",
            "--connect-timeout",
            "30",
            "--output",
            str(partial),
            BASE + name,
        ],
        check=True,
    )
    verify_archive(partial, expected)
    partial.replace(target)
    print(json.dumps({"file": name, "reused": False, "sha256": digest(target)}))


def extract_selected(archive: Path, selection: dict, output: Path) -> None:
    verify_archive(archive, SMALL_SHA1)
    output.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        for record in selection["records"]:
            tid = f"{int(record['provenance']['sourceRecordId']):06d}"
            relative = f"{tid[:3]}/{tid}.mp3"
            if record["audioPath"] != relative or record["id"] != f"fma:{tid}":
                raise ValueError("Selection identity/audio path mismatch")
            if canonical_license(record["provenance"]["recordingLicense"]["url"]) is None:
                raise ValueError("Selection has disallowed license")
            target = output / relative
            if not target.resolve().is_relative_to(output.resolve()):
                raise ValueError("Audio target escapes selected output directory")
            target.parent.mkdir(parents=True, exist_ok=True)
            temp = target.with_suffix(".mp3.tmp")
            with z.open("fma_small/" + relative) as source, temp.open("wb") as dest:
                shutil.copyfileobj(source, dest)
            temp.replace(target)
    print(json.dumps({"extracted": len(selection["records"]), "archiveSha256": digest(archive)}))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    acquire = commands.add_parser("download")
    acquire.add_argument("kind", choices=["metadata", "small"])
    acquire.add_argument("--cache", type=Path, required=True)
    inspect = commands.add_parser("inspect")
    inspect.add_argument("--metadata-archive", type=Path, required=True)
    inspect.add_argument("--limit", type=int, default=500)
    inspect.add_argument("--selection", type=Path, required=True)
    inspect.add_argument("--report", type=Path, required=True)
    extract = commands.add_parser("extract")
    extract.add_argument("--audio-archive", type=Path, required=True)
    extract.add_argument("--selection", type=Path, required=True)
    extract.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "download":
        download(args.kind, args.cache)
    elif args.command == "inspect":
        if args.limit < 1:
            parser.error("--limit must be positive")
        selection, report = inspect_metadata(args.metadata_archive, args.limit)
        write_json(args.selection, selection)
        write_json(args.report, report)
        print(
            json.dumps(
                {
                    k: v
                    for k, v in report.items()
                    if k not in {"exclusions", "eligibleIds", "selectedIds"}
                },
                indent=2,
            )
        )
    else:
        extract_selected(args.audio_archive, json.loads(args.selection.read_text()), args.output)


if __name__ == "__main__":
    main()
