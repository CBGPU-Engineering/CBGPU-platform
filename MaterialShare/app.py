"""Authenticated file transfer for the CBGPU materials page.

The website stores searchable metadata in Supabase. This service stores only
file bytes, under UUID names, on the server disk. Never expose it without HTTPS.
"""

import os
from pathlib import Path
from uuid import UUID

import httpx
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

MAX_FILE_BYTES = 200 * 1024 * 1024
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


def _file_path(material_id: UUID) -> Path:
    # UUID parsing prevents path traversal. Shard directories to avoid very
    # large flat directory listings after years of uploads.
    return STORAGE_ROOT / material_id.hex[:2] / material_id.hex


@app.get('/health')
async def health():
    return {'ok': True}


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
