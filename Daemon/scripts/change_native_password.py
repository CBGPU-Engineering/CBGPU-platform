#!/usr/bin/env python3
"""
change_native_password.py

Password-change script for JupyterHub NativeAuthenticator users.
Configure the path in config.yaml's native.command before use.

Usage: python3 change_native_password.py <username> <new_password>

Dependency: pip install bcrypt
"""

import sys
import sqlite3

# JupyterHub database path (adjust to match your environment)
DB_PATH = "/srv/jupyterhub/jupyterhub.sqlite"

# NativeAuthenticator user table name (usually "users", may vary by version)
TABLE_NAME = "users"
USERNAME_COL = "user_name"
PASSWORD_COL = "password"


def change_password(username: str, new_password: str):
    try:
        import bcrypt
    except ImportError:
        print("Error: bcrypt not installed. Run: pip install bcrypt", file=sys.stderr)
        sys.exit(1)

    hashed = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        cursor.execute(
            f"UPDATE {TABLE_NAME} SET {PASSWORD_COL} = ? WHERE {USERNAME_COL} = ?",
            (hashed, username),
        )
        if cursor.rowcount == 0:
            print(f"Warning: user '{username}' not found in {TABLE_NAME}", file=sys.stderr)
            sys.exit(1)
        conn.commit()
        print(f"Password updated for '{username}'")
    finally:
        conn.close()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <username> <new_password>", file=sys.stderr)
        sys.exit(1)
    change_password(sys.argv[1], sys.argv[2])
