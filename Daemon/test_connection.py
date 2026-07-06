#!/usr/bin/env python3
"""
Supabase connection test
Usage: python3 test_connection.py
"""

import sys
import yaml
import requests


def main():
    cfg_path = sys.argv[1] if len(sys.argv) > 1 else "config.yaml"

    with open(cfg_path, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    url = cfg["supabase_url"].rstrip("/")
    key = cfg["supabase_anon_key"]
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    tests = [
        ("gpus",         f"{url}/rest/v1/gpus?select=id,password"),
        ("reservations", f"{url}/rest/v1/reservations?select=id,gpu_id,status&limit=3"),
    ]

    all_ok = True
    for name, endpoint in tests:
        try:
            resp = requests.get(endpoint, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                print(f"[OK] {name}: {len(data)} row(s) fetched")
            else:
                print(f"[FAIL] {name}: HTTP {resp.status_code} - {resp.text}")
                all_ok = False
        except Exception as e:
            print(f"[FAIL] {name}: {e}")
            all_ok = False

    print()
    if all_ok:
        print("Connection succeeded - the daemon can run.")
    else:
        print("Connection failed - check the Supabase URL/key or RLS settings.")
        sys.exit(1)


if __name__ == "__main__":
    main()
