"""What the VPS has in the way of memory, and how much of it is ours.

The host figure comes from the kernel (/proc/meminfo on the Linux server; a
sysctl/vm_stat reading on a macOS dev box) rather than from a library, so the
deployment needs no extra dependency. The "our site" figure is the backend's
systemd cgroup where one exists - that covers every uvicorn worker at once,
which a single process's RSS would not.
"""
from __future__ import annotations

import os
import platform
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

MEMINFO = "/proc/meminfo"


def _read_meminfo() -> dict[str, int]:
    """Every /proc/meminfo row as bytes, keyed by its label."""
    values: dict[str, int] = {}
    with open(MEMINFO, "r") as handle:
        for line in handle:
            label, _, rest = line.partition(":")
            parts = rest.split()
            if not parts:
                continue
            try:
                amount = int(parts[0])
            except ValueError:
                continue
            # Rows are in kB unless they say otherwise; the handful that carry
            # no unit are counts, and we do not read any of those.
            values[label] = amount * 1024 if len(parts) > 1 else amount
    return values


def _linux_memory() -> dict | None:
    try:
        info = _read_meminfo()
    except OSError:
        return None

    total = info.get("MemTotal")
    if not total:
        return None

    # MemAvailable is the kernel's own estimate of what a new workload could
    # claim without swapping - a truer "free" than MemFree, which ignores the
    # cache the kernel would hand back on demand.
    available = info.get("MemAvailable", info.get("MemFree", 0))
    used = total - available

    swap_total = info.get("SwapTotal", 0)
    swap_used = swap_total - info.get("SwapFree", 0)

    return {
        "source": "linux",
        "total_bytes": total,
        "used_bytes": used,
        "available_bytes": available,
        "cached_bytes": info.get("Cached", 0) + info.get("Buffers", 0),
        "used_percent": round(used / total * 100, 1),
        "swap": (
            {
                "total_bytes": swap_total,
                "used_bytes": swap_used,
                "used_percent": round(swap_used / swap_total * 100, 1),
            }
            if swap_total
            else None
        ),
    }


def _darwin_memory() -> dict | None:
    """Development machines only - macOS accounting is close, not exact."""
    try:
        total = int(subprocess.run(["sysctl", "-n", "hw.memsize"], capture_output=True, text=True, timeout=2).stdout.strip())
        stats = subprocess.run(["vm_stat"], capture_output=True, text=True, timeout=2).stdout
    except (OSError, ValueError, subprocess.SubprocessError):
        return None
    if not total or not stats:
        return None

    page_size = 4096
    header = re.search(r"page size of (\d+) bytes", stats)
    if header:
        page_size = int(header.group(1))

    pages = {}
    for line in stats.splitlines()[1:]:
        label, _, value = line.partition(":")
        digits = value.strip().rstrip(".")
        if digits.isdigit():
            pages[label.strip()] = int(digits) * page_size

    used = (
        pages.get("Pages active", 0)
        + pages.get("Pages wired down", 0)
        + pages.get("Pages occupied by compressor", 0)
    )
    available = max(total - used, 0)
    return {
        "source": "darwin",
        "total_bytes": total,
        "used_bytes": used,
        "available_bytes": available,
        "cached_bytes": pages.get("File-backed pages", 0),
        "used_percent": round(used / total * 100, 1),
        "swap": None,
    }


def _systemd_unit_from_cgroup(path: str) -> str | None:
    for segment in reversed([item for item in path.split("/") if item]):
        if segment.endswith((".service", ".scope", ".slice")):
            return segment.replace("\\x2d", "-")
    return None


def _readable_unit_label(unit: str) -> str:
    name = re.sub(r"\.(service|scope|slice)$", "", unit)
    name = re.sub(r"[_@.-]+", " ", name).strip()
    return name.title() if name else unit


def _cgroup_info() -> tuple[int, str] | None:
    """Memory charged to the backend's cgroup, where the host exposes it."""
    try:
        with open("/proc/self/cgroup", "r") as handle:
            # cgroup v2 writes a single "0::/system.slice/<unit>" line.
            path = handle.read().strip().split("::")[-1].strip()
    except (OSError, IndexError):
        return None
    if not path:
        return None

    for filename in ("memory.current", "memory.usage_in_bytes"):
        candidate = os.path.join("/sys/fs/cgroup", path.lstrip("/"), filename)
        try:
            with open(candidate, "r") as handle:
                return int(handle.read().strip()), path
        except (OSError, ValueError):
            continue
    return None


def _self_rss_bytes() -> int | None:
    try:
        with open("/proc/self/status", "r") as handle:
            for line in handle:
                if line.startswith("VmRSS:"):
                    return int(line.split()[1]) * 1024
    except (OSError, ValueError, IndexError):
        pass

    if platform.system() == "Darwin":
        try:
            output = subprocess.run(
                ["ps", "-o", "rss=", "-p", str(os.getpid())], capture_output=True, text=True, timeout=2
            ).stdout.strip()
            return int(output) * 1024
        except (OSError, ValueError, subprocess.SubprocessError):
            return None
    return None


def _app_usage() -> dict | None:
    cgroup = _cgroup_info()
    if cgroup is not None:
        used_bytes, path = cgroup
        unit = _systemd_unit_from_cgroup(path)
        if unit:
            label = f"{_readable_unit_label(unit)} service"
            usage_label = f"held by {unit}"
        else:
            label = "Application cgroup"
            usage_label = "held by application cgroup"
        return {
            "bytes": used_bytes,
            "scope": "service",
            "label": label,
            "usage_label": usage_label,
            "cgroup_path": path,
        }

    rss = _self_rss_bytes()
    if rss is not None:
        process_name = Path(sys.argv[0] or "backend").name or "backend"
        return {
            "bytes": rss,
            "scope": "process",
            "label": f"{process_name} process",
            "usage_label": f"held by {process_name}",
        }
    return None


def memory() -> dict:
    """Host memory and the backend's share of it, for the Super Admin dashboard."""
    reading = _linux_memory() if platform.system() == "Linux" else _darwin_memory()
    now = datetime.now(timezone.utc).isoformat()

    if reading is None:
        hostname = platform.node()
        return {
            "available": False,
            "generated_at": now,
            "hostname": hostname,
            "host_label": hostname or "current server",
            "server_label": "Host memory",
            "note": "This host does not expose a memory reading we can read.",
        }

    app = _app_usage()
    total = reading["total_bytes"]
    hostname = platform.node()
    return {
        "available": True,
        "generated_at": now,
        "hostname": hostname,
        "host_label": hostname or "current server",
        "server_label": f"{hostname} host" if hostname else "Host memory",
        "cpu_count": os.cpu_count(),
        "approximate": reading["source"] == "darwin",
        **{key: value for key, value in reading.items() if key != "source"},
        "app": (
            {**app, "percent_of_total": round(app["bytes"] / total * 100, 1) if total else None}
            if app
            else None
        ),
    }
