"""Release-aware download cache. Never silently substitute a different season."""

import json
import os
import ssl
import urllib.request
from pathlib import Path

import certifi
import duckdb

SOURCES = {
    "pbp": ("nflverse/nflverse-data", "pbp", "play_by_play_{season}.parquet", True),
    "opportunity": (
        "ffverse/ffopportunity",
        "latest-data",
        "ep_weekly_{season}.parquet",
        True,
    ),
    "rosters": (
        "nflverse/nflverse-data",
        "weekly_rosters",
        "roster_weekly_{season}.parquet",
        True,
    ),
    "snaps": (
        "nflverse/nflverse-data",
        "snap_counts",
        "snap_counts_{season}.parquet",
        True,
    ),
    "rushing": (
        "nflverse/nflverse-data",
        "pfr_advstats",
        "advstats_week_rush_{season}.parquet",
        False,
    ),
    "injuries": (
        "nflverse/nflverse-data",
        "injuries",
        "injuries_{season}.parquet",
        False,
    ),
}


def fetch(url):
    headers = {"User-Agent": "fantasy-dashboard/1.0"}
    if url.startswith("https://api.github.com/") and os.environ.get("GITHUB_TOKEN"):
        headers["Authorization"] = "Bearer " + os.environ["GITHUB_TOKEN"]
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(
        request, context=ssl.create_default_context(cafile=certifi.where()), timeout=90
    ) as response:
        return response.read()


def read_rows(path):
    with duckdb.connect() as db:
        result = db.execute(
            "select * from "
            + ("read_csv_auto(?)" if path.suffix == ".csv" else "read_parquet(?)"),
            [str(path)],
        )
        columns = [column[0] for column in result.description]
        return [dict(zip(columns, row)) for row in result.fetchall()]


def download(season, cache):
    cache = Path(cache)
    cache.mkdir(parents=True, exist_ok=True)
    rows, manifests = {}, []
    for name, (repo, tag, pattern, required) in SOURCES.items():
        release = json.loads(
            fetch(f"https://api.github.com/repos/{repo}/releases/tags/{tag}")
        )
        filename = pattern.format(season=season)
        asset = next((a for a in release["assets"] if a["name"] == filename), None)
        if asset is None:
            if required:
                raise RuntimeError(
                    f"Required {name} source has no {season} asset: {filename}"
                )
            rows[name] = []
            manifests.append(
                {
                    "name": name,
                    "updatedAt": release["published_at"],
                    "throughWeek": 0,
                    "required": False,
                }
            )
            continue
        path = cache / filename
        stamp = cache / (filename + ".updated")
        if (
            not path.exists()
            or not stamp.exists()
            or stamp.read_text() != asset["updated_at"]
        ):
            temporary = cache / (filename + ".tmp")
            temporary.write_bytes(fetch(asset["browser_download_url"]))
            os.replace(temporary, path)
            stamp.write_text(asset["updated_at"])
        rows[name] = read_rows(path)
        weeks = [
            int(r["week"])
            for r in rows[name]
            if r.get("week") is not None
            and r.get("game_type", r.get("season_type", "REG")) == "REG"
        ]
        manifests.append(
            {
                "name": name,
                "updatedAt": asset["updated_at"],
                "throughWeek": max(weeks, default=0),
                "required": required,
            }
        )
    # Schedules is versioned by the current commit rather than a release asset.
    commit = json.loads(
        fetch(
            "https://api.github.com/repos/nflverse/nfldata/commits?path=data/games.csv&per_page=1"
        )
    )[0]
    path = cache / "games.csv"
    stamp = cache / "games.csv.commit"
    if not path.exists() or not stamp.exists() or stamp.read_text() != commit["sha"]:
        temporary = cache / "games.csv.tmp"
        temporary.write_bytes(
            fetch(
                f"https://raw.githubusercontent.com/nflverse/nfldata/{commit['sha']}/data/games.csv"
            )
        )
        os.replace(temporary, path)
        stamp.write_text(commit["sha"])
    rows["games"] = [
        r for r in read_rows(path) if r["season"] == season and r["game_type"] == "REG"
    ]
    manifests.append(
        {
            "name": "schedules",
            "updatedAt": commit["commit"]["committer"]["date"],
            "throughWeek": max(
                (
                    r["week"]
                    for r in rows["games"]
                    if r["home_score"] is not None and r["away_score"] is not None
                ),
                default=0,
            ),
            "required": True,
        }
    )
    return rows, manifests
