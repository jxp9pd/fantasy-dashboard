"""Exercise the actual production receiver without network or server access."""

import importlib.util
import io
import json
from pathlib import Path
import tarfile

import pytest

spec = importlib.util.spec_from_file_location("receiver", Path(__file__).parents[1] / "deploy/receive.py")
receiver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(receiver)


def payload(extra=None, omit=None, asset="app-first.js"):
    files = {
        "index.html": f'<script src="/fantasy-dashboard/assets/{asset}"></script>',
        f"assets/{asset}": "console.log('build');",
        "metric-notes.html": "Metric notes",
    }
    for pos in ("wr", "rb", "te"):
        files[f"data/{pos}.json"] = json.dumps({"players": [], "meta": {
            "position": pos.upper(), "season": 2026, "builtAt": "2026-10-06T00:00:00Z", "dataThroughWeek": 4,
        }})
    files.update(extra or {})
    if omit:
        del files[omit]
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
        for name, value in files.items():
            info = tarfile.TarInfo(name)
            if isinstance(value, tarfile.TarInfo):
                tar.addfile(value)
            else:
                data = value.encode()
                info.size = len(data)
                tar.addfile(info, io.BytesIO(data))
    buffer.seek(0)
    return buffer


def test_publishes_complete_release_and_preserves_old_assets(tmp_path):
    receiver.receive(payload(), tmp_path)
    first = (tmp_path / "current").resolve()
    receiver.receive(payload(asset="app-second.js"), tmp_path)
    current = tmp_path / "current"
    assert current.is_symlink() and current.resolve() != first
    assert (current / "data/wr.json").is_file()
    assert (current / "data/rb.json").is_file()
    assert (current / "data/te.json").is_file()
    assert (current / "assets/app-first.js").is_file()
    assert (current / "assets/app-second.js").is_file()
    assert current.resolve().stat().st_mode & 0o777 == 0o755


@pytest.mark.parametrize("kwargs", [
    {"omit": "data/rb.json"},
    {"omit": "data/te.json"},
    {"omit": "assets/app-first.js"},
    {"extra": {"data/rb.json": "not json"}},
    {"extra": {"data/te.json": "not json"}},
    {"extra": {"../escaped": "bad"}},
    {"extra": {"/absolute": "bad"}},
    {"extra": {".env": "private"}},
    {"extra": {"data/rb.json": json.dumps({"players": [], "meta": {
        "position": "RB", "season": 2025, "builtAt": "different", "dataThroughWeek": 1,
    }})}},
    {"extra": {"data/te.json": json.dumps({"players": [], "meta": {
        "position": "TE", "season": 2025, "builtAt": "different", "dataThroughWeek": 1,
    }})}},
])
def test_invalid_release_keeps_previous_snapshot(tmp_path, kwargs):
    receiver.receive(payload(), tmp_path)
    previous = (tmp_path / "current").resolve()
    with pytest.raises((ValueError, FileNotFoundError)):
        receiver.receive(payload(**kwargs), tmp_path)
    assert (tmp_path / "current").resolve() == previous
    assert len(list((tmp_path / "releases").iterdir())) == 1


def test_rejects_symlinks(tmp_path):
    link = tarfile.TarInfo("assets/secret")
    link.type = tarfile.SYMTYPE
    link.linkname = "/etc/passwd"
    with pytest.raises(ValueError, match="ordinary files"):
        receiver.receive(payload(extra={link.name: link}), tmp_path)
    assert not (tmp_path / "current").exists()
