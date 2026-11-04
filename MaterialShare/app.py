"""Authenticated file transfer for the CBGPU materials page.

The website stores searchable metadata in Supabase. This service stores only
file bytes, under UUID names, on the server disk. Never expose it without HTTPS.
"""

import asyncio
import json
import time
from contextlib import asynccontextmanager
from weakref import WeakValueDictionary
import os
import shutil
import tempfile
from pathlib import Path
from uuid import UUID

import httpx
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

MAX_FILE_BYTES = 1024 * 1024 * 1024
MAX_CHUNK_BYTES = 8 * 1024 * 1024
PARTIAL_TTL_SECONDS = 24 * 60 * 60
# 자료 공유 전체가 서버 디스크를 이 이상 쓰지 못하게 한다. 넘으면 새 업로드를 거절한다.
MAX_TOTAL_BYTES = int(os.environ.get('CBGPU_MATERIALS_QUOTA_BYTES', 100 * 1024 ** 3))
STORAGE_ROOT = Path(os.environ.get('CBGPU_MATERIALS_DIR', '/home/cbgpu/cbgpu-materials'))
SUPABASE_URL = os.environ.get('CBGPU_SUPABASE_URL', '').rstrip('/')
SUPABASE_ANON_KEY = os.environ.get('CBGPU_SUPABASE_ANON_KEY', '')
ALLOWED_ORIGINS = [origin.strip() for origin in os.environ.get(
    'CBGPU_MATERIALS_ORIGINS', 'https://cbgpu.com,https://admin.cbgpu.com,http://localhost:3000'
).split(',') if origin.strip()]

@asynccontextmanager
async def lifespan(_app: FastAPI):
    async def clean_periodically():
        while True:
            async with _quota_lock:
                await run_in_threadpool(_cleanup_expired)
            await asyncio.sleep(600)
    task = asyncio.create_task(clean_periodically())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(lifespan=lifespan, title='CBGPU materials transfer', docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=['GET', 'PUT', 'DELETE'],
    allow_headers=['Authorization', 'Content-Type'],
)


def _require_config() -> None:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(503, 'File service is not configured')


def _bearer(authorization: str | None) -> str:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, 'Login required')
    return authorization[7:]


def _headers(token: str) -> dict[str, str]:
    return {'apikey': SUPABASE_ANON_KEY, 'Authorization': f'Bearer {token}'}


async def _user_id(client: httpx.AsyncClient, token: str) -> str:
    response = await client.get(f'{SUPABASE_URL}/auth/v1/user', headers=_headers(token))
    if response.status_code != 200:
        raise HTTPException(401, 'Invalid session')
    return response.json()['id']


async def _material(client: httpx.AsyncClient, token: str, material_id: UUID) -> dict:
    response = await client.get(
        f'{SUPABASE_URL}/rest/v1/shared_materials',
        params={'id': f'eq.{material_id}', 'select': '*', 'limit': '1'},
        headers=_headers(token),
    )
    if response.status_code != 200:
        raise HTTPException(503, 'Materials database is unavailable')
    rows = response.json()
    if not rows:
        raise HTTPException(404, 'Material not found')
    return rows[0]


# One service worker owns disk/quota serialization. Locks disappear after use.
_quota_lock = asyncio.Lock()
_material_locks: WeakValueDictionary[UUID, asyncio.Lock] = WeakValueDictionary()


def _material_lock(material_id: UUID) -> asyncio.Lock:
    lock = _material_locks.get(material_id)
    if lock is None:
        lock = asyncio.Lock()
        _material_locks[material_id] = lock
    return lock


def _partial(path: Path) -> Path:
    return path.with_suffix('.partial')


def _reservation(path: Path) -> Path:
    return path.with_suffix('.upload.json')


def _cleanup_expired() -> None:
    """Only UUID-named, inactive partial uploads expire; completed files stay intact."""
    if not STORAGE_ROOT.is_dir():
        return
    cutoff = time.time() - PARTIAL_TTL_SECONDS
    for shard in STORAGE_ROOT.iterdir():
        if shard.is_symlink() or not shard.is_dir():
            continue
        for entry in shard.iterdir():
            if entry.is_symlink() or not entry.is_file() or not entry.name.endswith(('.partial', '.upload.json')):
                continue
            try:
                material_id = UUID(hex=entry.name.split('.')[0])
                path = _file_path(material_id)
                if path.parent != shard or path.name != entry.name.split('.')[0]:
                    continue
                lock = _material_locks.get(material_id)
                if lock and lock.locked():
                    continue
                parts = [_partial(path), _reservation(path)]
                existing = [part for part in parts if part.exists()]
                if existing and max(part.stat().st_mtime for part in existing) < cutoff:
                    for part in existing:
                        part.unlink(missing_ok=True)
            except (ValueError, FileNotFoundError):
                continue


def _scan_storage() -> tuple[int, int, int]:
    """Completed bytes and persistent full-size reservations, including after restarts."""
    total = count = reserved = 0
    if not STORAGE_ROOT.is_dir():
        return 0, 0, 0
    for shard in STORAGE_ROOT.iterdir():
        if shard.is_symlink() or not shard.is_dir():
            continue
        partials: dict[str, int] = {}
        manifests: dict[str, int] = {}
        completed: set[str] = set()
        for entry in shard.iterdir():
            if entry.is_symlink() or not entry.is_file():
                continue
            try:
                if entry.name.endswith('.partial'):
                    partials[entry.name[:-8]] = entry.stat().st_size
                elif entry.name.endswith('.upload.json'):
                    value = json.loads(entry.read_text())
                    size = value.get('size_bytes')
                    if isinstance(size, int) and 0 < size <= MAX_FILE_BYTES:
                        manifests[entry.name[:-12]] = size
                else:
                    UUID(hex=entry.name)
                    total += entry.stat().st_size
                    count += 1
                    completed.add(entry.name)
            except (ValueError, OSError):
                continue
        for identifier in partials.keys() | manifests.keys():
            if identifier not in completed:
                reserved += max(partials.get(identifier, 0), manifests.get(identifier, 0))
    return total, count, reserved


async def _usage() -> dict:
    await run_in_threadpool(_cleanup_expired)
    used, count, reserved = await run_in_threadpool(_scan_storage)
    return {'used_bytes': used, 'reserved_bytes': reserved, 'quota_bytes': MAX_TOTAL_BYTES,
            'remaining_bytes': max(MAX_TOTAL_BYTES - used - reserved, 0), 'file_count': count}


async def _reserve(material: dict, material_id: UUID, user_id: str) -> Path:
    path = _file_path(material_id)
    size = material.get('size_bytes')
    if not isinstance(size, int) or isinstance(size, bool) or not 0 < size <= MAX_FILE_BYTES:
        raise HTTPException(413, 'File is too large or has an invalid size')
    path.parent.mkdir(parents=True, exist_ok=True)
    manifest = _reservation(path)
    async with _quota_lock:
        if manifest.exists():
            try:
                saved = json.loads(manifest.read_text())
            except (ValueError, OSError):
                raise HTTPException(409, 'Upload reservation is invalid; delete and retry') from None
            if saved.get('uploader_id') != user_id or saved.get('size_bytes') != size:
                raise HTTPException(409, 'Upload metadata changed; delete and retry')
        else:
            usage = await _usage()
            # An unmanifested partial already occupies this much of the quota.
            existing = _partial(path).stat().st_size if _partial(path).exists() else 0
            if max(size - existing, 0) > usage['remaining_bytes']:
                raise HTTPException(507, 'Materials storage is full')
            manifest.write_text(json.dumps({'uploader_id': user_id, 'size_bytes': size}))
            os.chmod(manifest, 0o600)
        os.utime(manifest, None)
    return path


async def _finish(client: httpx.AsyncClient, token: str, material: dict, material_id: UUID, user_id: str) -> None:
    path = _file_path(material_id)
    temporary = _partial(path)
    if not path.exists():
        if not temporary.is_file() or temporary.stat().st_size != material['size_bytes']:
            raise HTTPException(409, 'Upload is incomplete')
        os.replace(temporary, path)
    if path.stat().st_size != material['size_bytes']:
        raise HTTPException(409, 'File size does not match the upload')
    response = await client.patch(
        f'{SUPABASE_URL}/rest/v1/shared_materials',
        params={'id': f'eq.{material_id}', 'uploader_id': f'eq.{user_id}', 'status': 'eq.pending'},
        headers={**_headers(token), 'Content-Type': 'application/json', 'Prefer': 'return=representation'},
        json={'status': 'ready'},
    )
    if response.status_code != 200 or not response.json():
        # Keep the complete UUID file/reservation: a subsequent status request
        # can reconcile a lost database response without re-uploading bytes.
        raise HTTPException(503, 'Could not finish upload; retry the upload status request')
    _reservation(path).unlink(missing_ok=True)


async def _owned(client: httpx.AsyncClient, token: str, material_id: UUID) -> tuple[str, dict]:
    user_id = await _user_id(client, token)
    material = await _material(client, token, material_id)
    if material['uploader_id'] != user_id:
        raise HTTPException(403, 'Only the uploader can finish this upload')
    return user_id, material


async def _require_admin(client: httpx.AsyncClient, token: str, user_id: str) -> None:
    response = await client.get(
        f'{SUPABASE_URL}/rest/v1/profiles',
        params={'id': f'eq.{user_id}', 'select': 'is_admin', 'limit': '1'},
        headers=_headers(token),
    )
    rows = response.json() if response.status_code == 200 else []
    if not rows or rows[0].get('is_admin') is not True:
        raise HTTPException(403, 'Admin only')


def _file_path(material_id: UUID) -> Path:
    # UUID parsing prevents path traversal. Shard directories to avoid very
    # large flat directory listings after years of uploads.
    return STORAGE_ROOT / material_id.hex[:2] / material_id.hex


@app.get('/health')
async def health():
    _require_config()
    try:
        def check_storage() -> None:
            if not STORAGE_ROOT.is_dir() or shutil.disk_usage(STORAGE_ROOT).free == 0:
                raise OSError('storage unavailable')
            with tempfile.TemporaryFile(dir=STORAGE_ROOT) as probe:
                probe.write(b'cbgpu-ready')
                probe.flush()

        await run_in_threadpool(check_storage)
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(
                f'{SUPABASE_URL}/rest/v1/shared_materials',
                params={'select': 'id', 'limit': '0'},
                headers={'apikey': SUPABASE_ANON_KEY, 'Authorization': f'Bearer {SUPABASE_ANON_KEY}'},
            )
        if response.status_code != 200:
            raise HTTPException(503, 'Materials database is unavailable')
    except (OSError, httpx.HTTPError) as exc:
        raise HTTPException(503, 'Materials service is unavailable') from exc
    return {'ok': True}


@app.get('/materials/quota')
async def quota(authorization: str | None = Header(default=None)):
    _require_config()
    token = _bearer(authorization)
    async with httpx.AsyncClient(timeout=15) as client:
        await _user_id(client, token)
    async with _quota_lock:
        usage = await _usage()
    return {k: usage[k] for k in ('used_bytes', 'quota_bytes', 'remaining_bytes')}


@app.get('/admin/materials/usage')
async def admin_usage(authorization: str | None = Header(default=None)):
    _require_config()
    token = _bearer(authorization)
    async with httpx.AsyncClient(timeout=15) as client:
        await _require_admin(client, token, await _user_id(client, token))
    disk = await run_in_threadpool(shutil.disk_usage, STORAGE_ROOT if STORAGE_ROOT.is_dir() else STORAGE_ROOT.parent)
    async with _quota_lock:
        usage = await _usage()
    return {**usage, 'disk_total_bytes': disk.total, 'disk_free_bytes': disk.free}


@app.get('/materials/{material_id}/upload')
async def upload_status(material_id: UUID, authorization: str | None = Header(default=None)):
    _require_config()
    token = _bearer(authorization)
    async with _material_lock(material_id), httpx.AsyncClient(timeout=15) as client:
        user_id, material = await _owned(client, token, material_id)
        path = _file_path(material_id)
        if material['status'] == 'ready':
            if not path.is_file() or path.stat().st_size != material['size_bytes']:
                raise HTTPException(404, 'File not found')
            _reservation(path).unlink(missing_ok=True)
            return {'offset': material['size_bytes'], 'size_bytes': material['size_bytes'], 'complete': True, 'chunk_bytes': MAX_CHUNK_BYTES}
        if material['status'] != 'pending':
            raise HTTPException(403, 'Upload is not pending')
        if path.exists() or (_partial(path).exists() and _partial(path).stat().st_size == material['size_bytes']):
            await _finish(client, token, material, material_id, user_id)
            return {'offset': material['size_bytes'], 'size_bytes': material['size_bytes'], 'complete': True, 'chunk_bytes': MAX_CHUNK_BYTES}
        offset = _partial(path).stat().st_size if _partial(path).exists() else 0
        if offset > material['size_bytes']:
            raise HTTPException(409, 'Partial file is too large; delete and retry')
        return {'offset': offset, 'size_bytes': material['size_bytes'], 'complete': False, 'chunk_bytes': MAX_CHUNK_BYTES}


@app.put('/materials/{material_id}/chunks')
async def upload_chunk(material_id: UUID, request: Request, offset: int = 0, authorization: str | None = Header(default=None)):
    _require_config()
    token = _bearer(authorization)
    if offset < 0 or offset > MAX_FILE_BYTES:
        raise HTTPException(400, 'Invalid upload offset')
    async with _material_lock(material_id), httpx.AsyncClient(timeout=15) as client:
        user_id, material = await _owned(client, token, material_id)
        if material['status'] != 'pending':
            raise HTTPException(403, 'Upload is not pending')
        path = _file_path(material_id)
        if path.exists():
            raise HTTPException(409, 'File already exists; check upload status')
        temporary = _partial(path)
        current = temporary.stat().st_size if temporary.exists() else 0
        if current != offset:
            raise HTTPException(409, 'Upload offset does not match; check upload status')
        declared = request.headers.get('content-length')
        if declared is not None:
            try:
                length = int(declared)
            except ValueError:
                raise HTTPException(400, 'Invalid chunk size') from None
            if not 0 < length <= MAX_CHUNK_BYTES or offset + length > material['size_bytes']:
                raise HTTPException(413, 'Chunk is too large or does not match the upload')
        await _reserve(material, material_id, user_id)
        received = 0
        with temporary.open('r+b' if temporary.exists() else 'x+b') as target:
            target.seek(offset)
            try:
                async for chunk in request.stream():
                    received += len(chunk)
                    if received > MAX_CHUNK_BYTES or offset + received > material['size_bytes']:
                        raise HTTPException(413, 'Chunk is too large or does not match the upload')
                    target.write(chunk)
                if not received or (declared is not None and received != int(declared)):
                    raise HTTPException(400, 'Chunk size does not match the request')
                target.flush()
                os.fsync(target.fileno())
            except BaseException:
                target.truncate(offset)
                raise
        os.utime(_reservation(path), None)
        complete = offset + received == material['size_bytes']
        if complete:
            await _finish(client, token, material, material_id, user_id)
    return {'ok': True, 'offset': offset + received, 'complete': complete}


@app.put('/materials/{material_id}/content')
async def upload(material_id: UUID, request: Request, authorization: str | None = Header(default=None)):
    """Legacy/native clients can still stream a whole file directly."""
    _require_config()
    token = _bearer(authorization)
    async with _material_lock(material_id), httpx.AsyncClient(timeout=15) as client:
        user_id, material = await _owned(client, token, material_id)
        if material['status'] != 'pending':
            raise HTTPException(403, 'Only the uploader can finish this upload')
        path = _file_path(material_id)
        if path.exists() or _partial(path).exists():
            raise HTTPException(409, 'File already exists or upload is in progress')
        declared = request.headers.get('content-length')
        if declared is not None:
            try:
                if int(declared) != material['size_bytes']:
                    raise HTTPException(400, 'File size does not match the upload')
            except ValueError:
                raise HTTPException(400, 'Invalid file size') from None
        await _reserve(material, material_id, user_id)
        total = 0
        try:
            with _partial(path).open('xb') as target:
                async for chunk in request.stream():
                    total += len(chunk)
                    if total > MAX_FILE_BYTES or total > material['size_bytes']:
                        raise HTTPException(413, 'File size does not match the upload')
                    target.write(chunk)
                target.flush()
                os.fsync(target.fileno())
            if total != material['size_bytes']:
                raise HTTPException(400, 'File size does not match the upload')
            await _finish(client, token, material, material_id, user_id)
        finally:
            if not path.exists():
                _partial(path).unlink(missing_ok=True)
                _reservation(path).unlink(missing_ok=True)
    return {'ok': True}


@app.get('/materials/{material_id}/content')
async def download(material_id: UUID, authorization: str | None = Header(default=None)):
    _require_config()
    token = _bearer(authorization)
    async with httpx.AsyncClient(timeout=15) as client:
        await _user_id(client, token)
        material = await _material(client, token, material_id)
    path = _file_path(material_id)
    if material['status'] != 'ready' or not path.is_file() or path.stat().st_size != material['size_bytes']:
        raise HTTPException(404, 'File not found')
    return FileResponse(
        path,
        media_type='application/octet-stream',
        filename=material['file_name'],
        content_disposition_type='attachment',
    )


@app.delete('/materials/{material_id}')
async def delete(material_id: UUID, authorization: str | None = Header(default=None)):
    _require_config()
    token = _bearer(authorization)
    async with _material_lock(material_id), httpx.AsyncClient(timeout=15) as client:
        user_id, material = await _owned(client, token, material_id)
        response = await client.delete(
            f'{SUPABASE_URL}/rest/v1/shared_materials',
            params={'id': f'eq.{material_id}', 'uploader_id': f'eq.{user_id}'},
            headers={**_headers(token), 'Prefer': 'return=representation'},
        )
        if response.status_code != 200 or not response.json():
            raise HTTPException(503, 'Could not delete material')
        async with _quota_lock:
            path = _file_path(material_id)
            path.unlink(missing_ok=True)
            _partial(path).unlink(missing_ok=True)
            _reservation(path).unlink(missing_ok=True)
    return {'ok': True}
