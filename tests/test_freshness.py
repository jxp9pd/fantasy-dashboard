import json

import pytest
from conftest import player

from pipeline.build import publish, run
from pipeline.metrics import build_documents, freshness


def test_source_lag():
    assert freshness(
        [{"name": "pbp", "throughWeek": 4}, {"name": "snaps", "throughWeek": 3}], 4
    ) == (3, True, ["snaps"])


def test_incomplete_game_excluded(source_rows, manifest):
    source_rows["pbp"] = [p for p in source_rows["pbp"] if p["week"] != 6]
    doc = build_documents(source_rows, manifest, 2026)
    assert doc["wr"]["meta"]["dataThroughWeek"] == 5
    assert player(doc, "wr")["weeks"][5]["values"]["actual"] is None


def test_missing_game_from_source_excluded(source_rows, manifest):
    source_rows["opportunity"] = [
        p
        for p in source_rows["opportunity"]
        if p["game_id"] != source_rows["games"][5]["game_id"]
    ]
    assert (
        build_documents(source_rows, manifest, 2026)["wr"]["meta"]["dataThroughWeek"]
        == 5
    )


def test_download_failure_preserves_files(tmp_path):
    out = tmp_path / "data"
    out.mkdir()
    (out / "wr.json").write_bytes(b"previous")
    (out / "rb.json").write_bytes(b"other")

    def failed(*args):
        raise OSError("download failed")

    with pytest.raises(OSError):
        run(2026, out, loader=failed)
    assert (out / "wr.json").read_bytes() == b"previous" and (
        out / "rb.json"
    ).read_bytes() == b"other"


def test_invalid_json_preserves_snapshot(tmp_path, documents):
    out = tmp_path / "data"
    publish(documents, out)
    previous = (out / "wr.json").read_bytes()
    documents["wr"]["meta"]["bad"] = float("nan")
    with pytest.raises(ValueError):
        publish(documents, out)
    assert (out / "wr.json").read_bytes() == previous


def test_snapshot_replace_and_json_numbers(tmp_path, documents):
    out = tmp_path / "data"
    publish(documents, out)
    publish(documents, out)
    assert out.is_symlink()
    assert json.loads((out / "wr.json").read_text())["players"]


def test_missing_game_marks_partial(source_rows, manifest):
    source_rows["snaps"] = [s for s in source_rows["snaps"] if s["week"] != 6]
    doc = build_documents(source_rows, manifest, 2026)["wr"]
    assert doc["meta"]["dataThroughWeek"] == 5 and doc["meta"]["partial"]
    assert "snaps" in doc["meta"]["laggingSources"]


def test_metadata_timestamp_shared(documents):
    assert documents["wr"]["meta"]["builtAt"] == documents["rb"]["meta"]["builtAt"]


def test_post_commit_cleanup_failure(tmp_path, documents, monkeypatch):
    from pipeline import build

    out = tmp_path / "data"
    publish(documents, out)
    real = build.shutil.rmtree

    def cleanup(path, ignore_errors=False):
        if ignore_errors:
            return
        return real(path)

    monkeypatch.setattr(build.shutil, "rmtree", cleanup)
    publish(documents, out)
    assert json.loads((out / "wr.json").read_text())["meta"]["season"] == 2026


def test_swap_failure_rolls_back_ordinary_output(tmp_path, documents, monkeypatch):
    from pipeline import build

    out = tmp_path / "data"
    out.mkdir()
    (out / "wr.json").write_bytes(b"old WR")
    (out / "rb.json").write_bytes(b"old RB")
    replace = build.os.replace

    def fail_swap(src, dest):
        if str(src).endswith(".data-next"):
            raise OSError("simulated publication failure")
        return replace(src, dest)

    monkeypatch.setattr(build.os, "replace", fail_swap)
    with pytest.raises(OSError):
        publish(documents, out)
    assert (out / "wr.json").read_bytes() == b"old WR"
    assert (out / "rb.json").read_bytes() == b"old RB"
