import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
// Load the pure TypeScript module without adding a test dependency to the app.
const source = fs.readFileSync('src/lib/contests.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const loaded = { exports: {} };
new Function('module', 'exports', compiled.outputText)(loaded, loaded.exports);
const { deadlineToISO, deadlineToInput, contestClosed, remainingTime, fileError, validateAnswers, isHttpUrl } = loaded.exports;
const field = { id: 'slides', label: '발표 자료', type: 'file', required: true, extensions: '.ppt,.pptx', max_size_mb: 1 };

test('Korea deadline roundtrip keeps seconds independently of device timezone', () => {
  assert.equal(deadlineToISO('2026-10-18T23:59:37'), '2026-10-18T14:59:37.000Z');
  assert.equal(deadlineToInput('2026-10-18T14:59:37.000Z'), '2026-10-18T23:59:37');
  assert.equal(deadlineToISO(''), null);
});
test('countdown rolls across days and closes at the precise server deadline', () => {
  const end = '2026-10-18T14:59:37.000Z';
  const endMs = Date.parse(end);
  assert.equal(remainingTime(end, endMs - 90061000), '1일 1시간 1분 1초 남음');
  assert.equal(remainingTime(end, endMs - 1), '0시간 0분 1초 남음');
  assert.equal(remainingTime(end, endMs), '마감되었어요');
  assert.equal(contestClosed({ is_open: true, ends_at: end }, endMs - 1), false);
  assert.equal(contestClosed({ is_open: true, ends_at: end }, endMs), true);
  assert.equal(contestClosed({ is_open: false, ends_at: null }, endMs), true);
});
test('each field applies its own arbitrary extension and size restrictions', () => {
  assert.equal(fileError({ name: '발표.PPTX', size: 100 }, field), null);
  assert.ok(fileError({ name: 'report.pdf', size: 100 }, field));
  assert.ok(fileError({ name: 'slides.pptx.exe', size: 100 }, field));
  assert.ok(fileError({ name: 'slides.ppt', size: 1048577 }, field));
  assert.ok(fileError({ name: 'slides.ppt', size: 0 }, field));
  assert.equal(fileError({ name: 'report.HWPX', size: 100 }, { ...field, extensions: '.hwp,.hwpx' }), null);
  assert.equal(fileError({ name: 'source.tar.gz', size: 100 }, { ...field, extensions: '.tar.gz' }), null);
});
test('required answers accept an existing file or a replacement; links only accept http(s)', () => {
  assert.ok(validateAnswers([field], {}));
  assert.equal(validateAnswers([field], { slides: { path: 'stored', name: 'a.pptx', size: 100 } }), null);
  assert.equal(validateAnswers([field], {}, { slides: { name: 'a.pptx', size: 100 } }), null);
  const link = { ...field, id: 'link', type: 'link' };
  assert.ok(validateAnswers([link], { link: 'javascript:alert(1)' }));
  assert.equal(validateAnswers([link], { link: 'https://example.com' }), null);
  assert.equal(isHttpUrl('data:text/html,test'), false);
});
