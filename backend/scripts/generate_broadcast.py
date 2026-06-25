"""Optional CLI wrapper around POST /api/broadcasts/{id}/generate.

Primary interface (UI & integrations):
  POST http://localhost:8000/api/broadcasts/{broadcast_id}/generate

This script calls the same generate_broadcast_files() logic directly for local/e2e use.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.xsell_helpers.broadcast_generate import generate_broadcast_files  # noqa: E402
from app.xsell_helpers.broadcast_main import list_broadcasts  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate broadcast Excel workbooks (same as POST /api/broadcasts/{id}/generate)"
    )
    parser.add_argument("--broadcast-id", help="Broadcast UUID to generate")
    parser.add_argument("--list", action="store_true", help="List broadcasts and exit")
    args = parser.parse_args()

    if args.list:
        rows = list_broadcasts()
        if not rows:
            print("No broadcasts found.")
            return
        for row in rows:
            gen = row.get("generated_at") or "not generated"
            print(f"{row['broadcast_id']}  {row['broadcast_name']}  [{gen}]")
        return

    if not args.broadcast_id:
        parser.error("Provide --broadcast-id or use --list")

    result = generate_broadcast_files(args.broadcast_id.strip())
    print(f"Generated {result['rows_assigned']} rows into {result['output_dir']}")
    for path in result["files_written"]:
        print(f"  - {path}")


if __name__ == "__main__":
    main()
