# CBGPU LaTeX

Real Overleaf Community Edition 6.3.2, with CBGPU identity, ZIP import and an independently implemented compile broker. This is not Overleaf Server Pro and does not enable its commercial modules.

- Researcher/app entry: `/latex`; real editor: `https://latex.cbgpu.com`.
- CBGPU approved-account login. Separate short-lived browser handoff, host-only Secure/HttpOnly cookies, native auth-session/approval/ban revalidation and live WebSocket revocation.
- ZIP: no fixed compressed, expanded-total or per-member byte cap; authenticated 8 MiB chunk transport, disk-backed validation/repacking, 1,000 files. Reject encryption, broken CRC, traversal, symlinks, duplicate names and excessive compression. Strip common directory wrappers, retain actual source structure, explicitly choose the main TeX file and compiler before importing. Failed validation never modifies existing projects. An ambiguous main document always remains selectable.
- Owner trash controls mirror Overleaf trash state; returning to the portal refreshes the project list. Other users cannot trash an owner’s project through this adapter.
- Engines: pdfLaTeX/XeLaTeX/LuaLaTeX/LaTeX, full TeX Live 2026 packages, no forced school or journal template. UTF-8 `.tex` inputs; convert legacy encodings before import.
- Per compile: 300 seconds, 2 CPU, 2 GiB RAM, 128 processes, disconnected networking, read-only container image, no capabilities, no host credentials or Docker socket. Compiler working files live in a **512 MiB tmpfs**, not an unbounded writable host mount. At most three simultaneous compiles. Root source snapshot is read-only; only validated regular output files are atomically published back. TeX/latexmk auxiliary subprocesses remain inside this sandbox. Oversized projects need splitting/asset reduction. This is CBGPU's own isolation adapter, not an official Overleaf CE sandbox feature.
- Native CE project authorization plus gateway checks protect direct output/PDF routes (some are served by CE nginx without app middleware).
- Project files/Mongo/Redis/secrets persist under `backend/private/latex`, never in Git. Compiler containers are disposable; they do not contain durable project data.

## Services

`docker compose -f backend/latex/compose.yml up -d` starts Mongo, Redis, CE and the private bridge. `cbgpu-latex-gateway.service` binds 127.0.0.1:3520; CE and trusted adapter are loopback 3521/3523. Only 3520 is published through the tunnel. Mongo/Redis have no host ports. `cbgpu-latex-compiler.service` exposes a narrow Unix socket to CLSI; CE never receives the Docker socket.

Python dependencies: `.venv/bin/pip install -r requirements.txt`. Use the systemd unit examples in `install.py`. Mongo 8.0.34 uses `GLIBC_TUNABLES=glibc.pthread.rseq=1` on this kernel to avoid its per-CPU TCMalloc/rseq incompatibility; pin digest before production updates.

CLSI runs as www-data; grant only the host broker UID access using an inherited ACL on the compile directory. `install.py` applies this through a narrowly mounted helper container. Never make the whole CE data directory public.

## Backups / verification

`cbgpu-latex-backup.timer` makes private daily Mongo(oplog)/Redis/files/config snapshots and retains seven. Compile/cache files are excluded. Backups are stored **on this computer**; they do not protect against loss of its disk. For recovery, restore to an empty stack and retain the original secrets; see `RESTORE.txt` inside each backup.

- `.venv/bin/python -m unittest -v test_zip_import`
- `.venv/bin/python test_compiler.py`
- `node backend/scripts/verify-latex.mjs` (temporary native/Overleaf users; no real mail)
- `CBGPU_TEST_PUBLIC=1 CBGPU_TEST_FRONTEND_PORT=3000 node backend/scripts/verify-latex.mjs`

## Source / license

Overleaf CE is AGPL-3.0: https://github.com/overleaf/overleaf. The pinned official image contains its corresponding application source under `/overleaf`. Retrieve the exact version with `docker pull sharelatex/sharelatex@sha256:ada39211c54a1e748065834ec44d3a49094cc475c28d8b803a251901592a94b2` and `docker cp CONTAINER:/overleaf ./overleaf-source`. CBGPU's compile adapter replacing `services/clsi/app/js/LocalCommandRunner.js`, bridge and integration source are provided at `/cbgpu/source.zip`, together with these run instructions. No proprietary Pro code is included.
