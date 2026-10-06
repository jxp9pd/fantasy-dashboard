"""CLI and transactional publication of a WR/RB/TE snapshot."""

import argparse
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

from .metrics import build_documents
from .sources import download


def publish(documents, out):
    out = Path(out).absolute()
    out.parent.mkdir(parents=True, exist_ok=True)
    snapshots = out.parent.parent / ".data-snapshots"
    snapshots.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".snapshot-", dir=snapshots))
    # A versioned directory plus atomic symlink swap publishes all positions together.
    # Existing ordinary directories are migrated with rollback on any rename failure.
    backup = None
    try:
        for position, document in documents.items():
            (staging / f"{position}.json").write_text(
                json.dumps(document, allow_nan=False, separators=(",", ":"))
            )
        link = out.parent / ("." + out.name + "-next")
        if link.is_symlink():
            link.unlink()
        link.symlink_to(os.path.relpath(staging, out.parent), target_is_directory=True)
        old_target = out.resolve() if out.is_symlink() else None
        if out.exists() and not out.is_symlink():
            backup = out.parent / ("." + out.name + "-previous")
            if backup.exists():
                shutil.rmtree(backup)
            os.replace(out, backup)
        try:
            os.replace(link, out)
        except Exception:
            if backup:
                os.replace(backup, out)
            raise
        if backup:
            shutil.rmtree(backup, ignore_errors=True)
        if old_target and old_target.name.startswith(".snapshot-"):
            shutil.rmtree(old_target, ignore_errors=True)
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise


def run(season, out, cache="data/raw", loader=download):
    rows, manifests = loader(season, cache)
    documents = build_documents(rows, manifests, season)
    publish(documents, out)
    return documents


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--season", type=int, required=True)
    parser.add_argument("--out", default="web/public/data")
    parser.add_argument("--cache", default="data/raw")
    args = parser.parse_args()
    try:
        docs = run(args.season, args.out, args.cache)
        print(
            f"Published {args.season}, through week {docs['wr']['meta']['dataThroughWeek']}: "
            + ", ".join(f"{len(d['players'])} {p.upper()}" for p, d in docs.items())
        )
    except Exception as exc:
        print(f"Refresh failed; previous snapshot preserved: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
