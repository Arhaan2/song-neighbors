"""Reproducible FMA acquisition and per-record rights selection (standard library)."""

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
import tempfile
import zipfile
from collections import Counter, defaultdict, deque
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

METADATA_SHA1 = "f0df49ffe5f2a6008d7dc83c6915b31835dfe733"
SMALL_SHA1 = "ade154f733639d52e35e32f5593efe5be76c6d70"
MEDIUM_SHA1 = "c67b69ea232021025fca9231fc1c7c1a063ab50b"
LARGE_SHA1 = "497109f4dd721066b5ce5e5f250ec604dc78939e"
# Official archive HEAD Content-Length, verified 2026-11-05. No full-length archive.
ARCHIVE_BYTES = {
    "metadata": 358_412_441,
    "small": 7_679_594_875,
    "medium": 23_825_005_356,
    "large": 100_306_112_191,
}
AUDIO_SUBSETS = ("small", "medium", "large")
DISK_RESERVE_BYTES = 2_000_000_000
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


def archive_identity(kind: str) -> tuple[str, str]:
    checksums = {
        "metadata": METADATA_SHA1,
        "small": SMALL_SHA1,
        "medium": MEDIUM_SHA1,
        "large": LARGE_SHA1,
    }
    if kind not in checksums:
        raise ValueError(f"Unsupported FMA archive: {kind}")
    return f"fma_{kind}.zip", checksums[kind]


def download(kind: str, cache: Path) -> None:
    name, expected = archive_identity(kind)
    cache.mkdir(parents=True, exist_ok=True)
    target = cache / name
    if target.exists():
        verify_archive(target, expected)
        print(json.dumps({"file": name, "reused": True, "sha256": digest(target)}))
        return
    partial = cache / (name + ".part")
    partial_size = partial.stat().st_size if partial.exists() else 0
    if partial_size > ARCHIVE_BYTES[kind]:
        raise ValueError(f"Partial {name} exceeds expected archive size; retain for inspection")
    # Adopt a completed transfer interrupted before verification/rename, avoiding HTTP 416.
    if partial_size == ARCHIVE_BYTES[kind]:
        verify_archive(partial, expected)
        partial.replace(target)
        print(json.dumps({"file": name, "reused": True, "sha256": digest(target)}))
        return
    remaining = ARCHIVE_BYTES[kind] - partial_size
    if shutil.disk_usage(cache).free < remaining + DISK_RESERVE_BYTES:
        raise ValueError(
            f"Insufficient free disk space for {name}: need {remaining + DISK_RESERVE_BYTES} "
            "bytes including 2GB reserve; selected extraction needs additional space"
        )
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


def extract_selected(archive: Path, selection: dict, output: Path, subset: str = "small") -> dict:
    """Verify the chosen cumulative archive, preflight all records, then atomically extract.

    Reruns compare existing files to the verified ZIP member's SHA-256 and reuse exact bytes.
    Archive kind is explicit, never inferred from recording IDs or the ZIP's filename.
    """
    from catalog import eligible_record

    if subset not in AUDIO_SUBSETS:
        raise ValueError(f"Unsupported audio subset: {subset}")
    _, expected = archive_identity(subset)
    verify_archive(archive, expected)
    allowed_sources = {f"fma-{name}" for name in AUDIO_SUBSETS[: AUDIO_SUBSETS.index(subset) + 1]}
    records = selection["records"]
    if not records:
        raise ValueError("Selection contains no recordings")
    seen = set()
    pending = []
    selected_bytes = 0
    reused = 0
    with zipfile.ZipFile(archive) as z:
        member_counts = Counter(z.namelist())
        for record in records:
            identifier = record.get("id", "missing-id")
            try:
                eligible_record(record)
                provenance = record["provenance"]
                if provenance["datasetId"] not in allowed_sources:
                    raise ValueError("record belongs to a larger or unknown source subset")
                if provenance["datasetVersion"] != DATASET_VERSION:
                    raise ValueError("source dataset version mismatch")
                source_id = provenance["sourceRecordId"]
                if not re.fullmatch(r"[1-9][0-9]*", source_id):
                    raise ValueError("invalid source recording ID")
                tid = f"{int(source_id):06d}"
                relative = f"{tid[:3]}/{tid}.mp3"
                if record["audioPath"] != relative or identifier != f"fma:{tid}":
                    raise ValueError("selection identity/audio path mismatch")
                if identifier in seen:
                    raise ValueError("duplicate recording ID in selection")
                seen.add(identifier)
                target = output / relative
                if not target.resolve().is_relative_to(output.resolve()):
                    raise ValueError("audio target escapes selected output directory")
                name = f"fma_{subset}/{relative}"
                if member_counts[name] != 1:
                    raise ValueError("selected archive member missing or duplicated")
                info = z.getinfo(name)
                if info.is_dir() or info.file_size <= 0:
                    raise ValueError("selected archive member is empty or not a file")
                selected_bytes += info.file_size
                if target.is_file() and target.stat().st_size == info.file_size:
                    with z.open(info) as source:
                        member_sha = hashlib.file_digest(source, "sha256").hexdigest()
                    if digest(target) == member_sha:
                        reused += 1
                        continue
                if target.exists() and not target.is_file():
                    raise ValueError("selected output is not a regular file")
                pending.append((identifier, info, target))
            except (KeyError, TypeError, ValueError) as error:
                raise ValueError(f"{identifier}: {error}") from error
        # Account for final growth plus one atomic replacement while its old bytes still exist.
        growth = sum(
            max(0, info.file_size - (p.stat().st_size if p.exists() else 0))
            for _, info, p in pending
        )
        temporary = max((info.file_size for _, info, _ in pending), default=0)
        ancestor = output.resolve()
        while not ancestor.exists():
            ancestor = ancestor.parent
        required = growth + temporary + DISK_RESERVE_BYTES
        if pending and shutil.disk_usage(ancestor).free < required:
            raise ValueError(
                f"Insufficient extraction space: need {required} bytes including 2GB reserve"
            )
        for identifier, info, target in pending:
            target.parent.mkdir(parents=True, exist_ok=True)
            temp = None
            try:
                with tempfile.NamedTemporaryFile(
                    dir=target.parent, suffix=".mp3.tmp", delete=False
                ) as dest:
                    temp = Path(dest.name)
                    with z.open(info) as source:
                        shutil.copyfileobj(source, dest)
                temp.replace(target)
            except (OSError, RuntimeError, zipfile.BadZipFile) as error:
                raise ValueError(
                    f"{identifier}: extraction failed: {type(error).__name__}"
                ) from error
            finally:
                if temp is not None:
                    temp.unlink(missing_ok=True)
    result = {
        "subset": subset,
        "selected": len(records),
        "selectedBytes": selected_bytes,
        "extracted": len(pending),
        "reused": reused,
        "archiveSha1": expected,
        "archiveSha256": digest(archive),
    }
    print(json.dumps(result))
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    acquire = commands.add_parser("download")
    acquire.add_argument("kind", choices=["metadata", *AUDIO_SUBSETS])
    acquire.add_argument("--cache", type=Path, required=True)
    inspect = commands.add_parser("inspect")
    inspect.add_argument("--metadata-archive", type=Path, required=True)
    inspect.add_argument("--limit", type=int, default=500)
    inspect.add_argument("--selection", type=Path, required=True)
    inspect.add_argument("--report", type=Path, required=True)
    extract = commands.add_parser("extract")
    extract.add_argument("--audio-archive", type=Path, required=True)
    extract.add_argument("--subset", choices=AUDIO_SUBSETS, default="small")
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
        extract_selected(
            args.audio_archive, json.loads(args.selection.read_text()), args.output, args.subset
        )


if __name__ == "__main__":
    main()
