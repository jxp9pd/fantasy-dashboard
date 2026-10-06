#!/usr/bin/env python3
"""Receive a static tar.gz on stdin, validate it, then atomically publish it.

Installed root-owned on the server; run by the restricted fantasy-deploy SSH key.
Only the Python standard library is needed on the host.
"""

import argparse
import fcntl
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import sys
import tarfile
import tempfile

MAX_BYTES = 64 * 1024 * 1024


def receive(stream, root):
    root = Path(root)
    releases = root / "releases"
    releases.mkdir(parents=True, exist_ok=True)
    with (root / ".deploy.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        staging = Path(tempfile.mkdtemp(prefix="release-", dir=releases))
        published = False
        try:
            archive = stream.read(MAX_BYTES + 1)
            if len(archive) > MAX_BYTES:
                raise ValueError("Archive exceeds the deployment size limit")
            with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as tar:
                total = 0
                count = 0
                for member in tar:
                    path = PurePosixPath(member.name)
                    count += 1
                    total += member.size
                    if count > 1000 or total > MAX_BYTES:
                        raise ValueError("Unpacked release exceeds deployment limits")
                    if path.is_absolute() or ".." in path.parts:
                        raise ValueError("Archive contains an unsafe path")
                    if any(part.startswith(".") for part in path.parts):
                        raise ValueError("Hidden files are not public assets")
                    target = staging.joinpath(*path.parts)
                    if member.isdir():
                        target.mkdir(parents=True, exist_ok=True)
                    elif member.isfile():
                        target.parent.mkdir(parents=True, exist_ok=True)
                        with tar.extractfile(member) as source, target.open("xb") as dest:
                            shutil.copyfileobj(source, dest)
                        target.chmod(0o644)
                    else:
                        raise ValueError("Only ordinary files and directories are allowed")

            index = (staging / "index.html").read_text()
            (staging / "metric-notes.html").read_text()
            assets = re.findall(r'(?:src|href)="(/fantasy-dashboard/assets/[^"?#]+)', index)
            if not assets:
                raise ValueError("The dashboard has no compiled assets")
            for asset in assets:
                relative = PurePosixPath(asset.removeprefix("/fantasy-dashboard/"))
                if ".." in relative.parts or not staging.joinpath(*relative.parts).is_file():
                    raise ValueError("A referenced dashboard asset is missing")

            snapshots = []
            for position in ("wr", "rb", "te"):
                data = json.loads((staging / "data" / f"{position}.json").read_text())
                if not isinstance(data["players"], list) or data["meta"]["position"] != position.upper():
                    raise ValueError("Invalid position snapshot")
                snapshots.append(tuple(data["meta"][key] for key in ("season", "builtAt", "dataThroughWeek")))
            if any(snapshot != snapshots[0] for snapshot in snapshots[1:]):
                raise ValueError("Position snapshots are from different builds")

            # Preserve hashed assets for tabs that loaded the previous index.html.
            current = root / "current"
            if (current / "assets").is_dir():
                for asset in (current / "assets").iterdir():
                    destination = staging / "assets" / asset.name
                    if asset.is_file() and not destination.exists():
                        shutil.copy2(asset, destination)
            staging.chmod(0o755)
            next_link = root / ".current-next"
            next_link.unlink(missing_ok=True)
            next_link.symlink_to(staging.relative_to(root), target_is_directory=True)
            os.replace(next_link, current)
            published = True
            # Keep recent releases for rollback. Assets remain available in current.
            older = sorted(releases.glob("release-*"), key=lambda p: p.stat().st_mtime, reverse=True)
            for release in older[5:]:
                if release != staging:
                    shutil.rmtree(release, ignore_errors=True)
            print(f"Published {staging.name}: season {snapshots[0][0]}, week {snapshots[0][2]}")
        finally:
            if not published:
                shutil.rmtree(staging, ignore_errors=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default="/var/www/fantasy-dashboard")
    args = parser.parse_args()
    try:
        receive(sys.stdin.buffer, args.root)
    except Exception as exc:
        print(f"Deployment failed; previous release preserved: {exc}", file=sys.stderr)
        sys.exit(1)
