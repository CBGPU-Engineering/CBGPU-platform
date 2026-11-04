import test from 'node:test';
import assert from 'node:assert/strict';
import { WindowRateLimiter, readJsonBody } from '../src/lib/requestSecurity.ts';

const request = body => new Request('http://localhost', { method: 'POST', body });

test('rejects requests above the window limit and resets at expiry', () => {
  const limiter = new WindowRateLimiter(2, 100);
  assert.equal(limiter.allow('a', 0), true);
  assert.equal(limiter.allow('a', 1), true);
  assert.equal(limiter.allow('a', 2), false);
  assert.equal(limiter.allow('b', 2), true);
  assert.equal(limiter.allow('a', 100), true);
});

test('memory capacity cannot evict an active rate limit', () => {
  const limiter = new WindowRateLimiter(1, 100, 1);
  assert.equal(limiter.allow('a', 0), true);
  assert.equal(limiter.allow('b', 1), false);
  assert.equal(limiter.allow('a', 1), false);
  assert.equal(limiter.allow('b', 100), true);
});

test('reads JSON and rejects malformed JSON', async () => {
  assert.deepEqual(await readJsonBody(request('{"a":1}'), 20), { a: 1 });
  await assert.rejects(readJsonBody(request('{'), 20), { status: 400 });
});

test('limits actual UTF-8 bytes when Content-Length is absent or false', async () => {
  await assert.rejects(readJsonBody(request('"가나다"'), 8), { status: 413 });
  const req = request('"abcdef"');
  req.headers.set('content-length', '1');
  await assert.rejects(readJsonBody(req, 4), { status: 413 });
});

test('rejects oversized declared Content-Length before reading', async () => {
  const req = request('{}');
  req.headers.set('content-length', '500');
  await assert.rejects(readJsonBody(req, 10), { status: 413 });
});
