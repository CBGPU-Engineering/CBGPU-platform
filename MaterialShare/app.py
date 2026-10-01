"""Authenticated file transfer for the CBGPU materials page.

The website stores searchable metadata in Supabase. This service stores only
file bytes, under UUID names, on the server disk. Never expose it without HTTPS.
"""

import asyncio
import os
import shutil
from pathlib import Path
from uuid import UUID

import httpx
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

MAX_FILE_BYTES = 1024 * 1024 * 1024
# 자료 공유 전체가 서버 디스크를 이 이상 쓰지 못하게 한다. 넘으면 새 업로드를 거절한다.
MAX_TOTAL_BYTES = int(os.environ.get('CBGPU_MATERIALS_QUOTA_BYTES', 100 * 1024 ** 3))
STORAGE_ROOT = Path(os.environ.get('CBGPU_MATERIALS_DIR', '/home/cbgpu/cbgpu-materials'))
SUPABASE_URL = os.environ.get('CBGPU_SUPABASE_URL', '').rstrip('/')
SUPABASE_ANON_KEY = os.environ.get('CBGPU_SUPABASE_ANON_KEY', '')
ALLOWED_ORIGINS = [origin.strip() for origin in os.environ.get(
    'CBGPU_MATERIALS_ORIGINS', 'https://cbgpu.vercel.app,http://localhost:3000'
).split(',') if origin.strip()]

app = FastAPI(title='CBGPU materials transfer', docs_url=None, redoc_url=None, openapi_url=None)
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


# 업로드가 동시에 여러 개 들어와도 합계가 한도를 넘지 않도록, 진행 중인 업로드의 선언 크기를
# 디스크 사용량에 더해서 검사한다 (검사와 예약은 하나의 락 안에서 한다).
_quota_lock = asyncio.Lock()
_inflight: dict[UUID, int] = {}


def _scan_storage() -> tuple[int, int]:
    """완료된 파일의 (총 바이트, 개수). 업로드 중인 .partial 파일은 _inflight가 따로 센다."""
    total = count = 0
    if not STORAGE_ROOT.is_dir():
        return 0, 0
    for shard in os.scandir(STORAGE_ROOT):
        if not shard.is_dir(follow_symlinks=False):
            continue
        for entry in os.scandir(shard.path):
            if entry.is_file(follow_symlinks=False) and not entry.name.endswith('.partial'):
                total += entry.stat(follow_symlinks=False).st_size
                count += 1
    return total, count


async def _usage() -> dict:
    used, count = await run_in_threadpool(_scan_storage)
    reserved = sum(_inflight.values())
    return {
        'used_bytes': used,
        'reserved_bytes': reserved,
        'quota_bytes': MAX_TOTAL_BYTES,
        'remaining_bytes': max(MAX_TOTAL_BYTES - used - reserved, 0),
        'file_count': count,
    }


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
    return {'ok': True}


@app.get('/materials/quota')
async def quota(authorization: str | None = Header(default=None)):
    _require_config()
    token = _bearer(authorization)
    async with httpx.AsyncClient(timeout=15) as client:
        await _user_id(client, token)
    usage = await _usage()
    return {k: usage[k] for k in ('used_bytes', 'quota_bytes', 'remaining_bytes')}


@app.get('/admin/materials/usage')
async def admin_usage(authorization: str | None = Header(default=None)):
    _require_config()
    token = _bearer(authorization)
    async with httpx.AsyncClient(timeout=15) as client:
        await _require_admin(client, token, await _user_id(client, token))
    disk = await run_in_threadpool(shutil.disk_usage, STORAGE_ROOT if STORAGE_ROOT.is_dir() else STORAGE_ROOT.parent)
    return {**await _usage(), 'disk_total_bytes': disk.total, 'disk_free_bytes': disk.free}


@app.put('/materials/{material_id}/content')
async def upload(material_id: UUID, request: Request, authorization: str | None = Header(default=None)):
    _require_config()
    token = _bearer(authorization)
    declared = request.headers.get('content-length')
    if declared:
        try:
            declared_bytes = int(declared)
        except ValueError:
            raise HTTPException(400, 'Invalid file size') from None
        if declared_bytes > MAX_FILE_BYTES:
            raise HTTPException(413, 'File is too large')
    async with httpx.AsyncClient(timeout=15) as client:
        user_id = await _user_id(client, token)
        material = await _material(client, token, material_id)
        if material['uploader_id'] != user_id or material['status'] != 'pending':
            raise HTTPException(403, 'Only the uploader can finish this upload')

        path = _file_path(material_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            raise HTTPException(409, 'File already exists')
        async with _quota_lock:
            usage = await _usage()
            if material['size_bytes'] > usage['remaining_bytes']:
                raise HTTPException(507, 'Materials storage is full')
            _inflight[material_id] = material['size_bytes']
        temporary = path.with_suffix('.partial')
        total = 0
        opened = False
        finalized = False
        try:
            with temporary.open('xb') as target:
                opened = True
                async for chunk in request.stream():
                    total += len(chunk)
                    if total > MAX_FILE_BYTES or total > material['size_bytes']:
                        raise HTTPException(413, 'File size does not match the upload')
                    target.write(chunk)
            if total != material['size_bytes']:
                raise HTTPException(400, 'File size does not match the upload')
            os.replace(temporary, path)
            finalized = True
            response = await client.patch(
                f'{SUPABASE_URL}/rest/v1/shared_materials',
                params={'id': f'eq.{material_id}', 'uploader_id': f'eq.{user_id}', 'status': 'eq.pending'},
                headers={**_headers(token), 'Content-Type': 'application/json', 'Prefer': 'return=representation'},
                json={'status': 'ready'},
            )
            if response.status_code != 200 or not response.json():
                raise HTTPException(503, 'Could not finish upload')
        except FileExistsError:
            raise HTTPException(409, 'Upload already in progress') from None
        except Exception:
            if finalized:
                path.unlink(missing_ok=True)
            raise
        finally:
            _inflight.pop(material_id, None)
            if opened:
                temporary.unlink(missing_ok=True)
    return {'ok': True}


@app.get('/materials/{material_id}/content')
async def download(material_id: UUID, authorization: str | None = Header(default=None)):
    _require_config()
    token = _bearer(authorization)
    async with httpx.AsyncClient(timeout=15) as client:
        await _user_id(client, token)
        material = await _material(client, token, material_id)
    path = _file_path(material_id)
    if material['status'] != 'ready' or not path.is_file():
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
    async with httpx.AsyncClient(timeout=15) as client:
        user_id = await _user_id(client, token)
        material = await _material(client, token, material_id)
        if material['uploader_id'] != user_id:
            raise HTTPException(403, 'Only the uploader can delete this material')
        response = await client.delete(
            f'{SUPABASE_URL}/rest/v1/shared_materials',
            params={'id': f'eq.{material_id}', 'uploader_id': f'eq.{user_id}'},
            headers=_headers(token),
        )
        if response.status_code not in (200, 204):
            raise HTTPException(503, 'Could not delete material')
    _file_path(material_id).unlink(missing_ok=True)
    return {'ok': True}
