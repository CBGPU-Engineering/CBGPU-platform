#!/usr/bin/env python3
"""
change_native_password.py

JupyterHub NativeAuthenticator 사용자 비밀번호 변경 스크립트
config.yaml의 native.command에 경로 설정 후 사용

사용법: python3 change_native_password.py <username> <new_password>

의존성: pip install bcrypt
"""

import sys
import sqlite3

# JupyterHub 데이터베이스 경로 (환경에 맞게 수정)
DB_PATH = "/srv/jupyterhub/jupyterhub.sqlite"

# NativeAuthenticator 유저 테이블명 (보통 "users", 버전에 따라 다를 수 있음)
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
