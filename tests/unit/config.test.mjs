import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPreviewConfig } from '../../scripts/preview/config.mjs';

test('preview binds only to loopback and supports a configurable port', () => {
  assert.deepEqual(getPreviewConfig({}), { host: '127.0.0.1', port: 3000 });
  assert.deepEqual(getPreviewConfig({ PORT: '3001', HOST: '0.0.0.0' }), {
    host: '127.0.0.1',
    port: 3001,
  });
});

test('invalid ports are rejected before starting the server', () => {
  for (const PORT of [
    '',
    '0',
    '65536',
    '-1',
    '3.5',
    'NaN',
    '3000oops',
    ' 3000',
  ]) {
    assert.throws(() => getPreviewConfig({ PORT }), /PORT/);
  }
});
