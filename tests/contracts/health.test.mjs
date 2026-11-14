import assert from 'node:assert/strict';
import { test } from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import specification from '@e507/contracts/openapi' with { type: 'json' };
import { createPreviewServer } from '../../scripts/preview/server.mjs';

test('live health response and example match the published response schema', async (context) => {
  const operation = specification.paths['/api/health'].get;
  const responseContract =
    operation.responses['200'].content['application/json'];
  const schemaName = responseContract.schema.$ref.split('/').at(-1);
  const validate = new Ajv2020({ strict: true }).compile(
    specification.components.schemas[schemaName],
  );
  assert.ok(
    validate(responseContract.example),
    JSON.stringify(validate.errors),
  );
  const server = createPreviewServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  context.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  );
  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/health`,
  );
  assert.equal(response.status, 200);
  assert.ok(validate(await response.json()), JSON.stringify(validate.errors));
  assert.equal(validate({ status: 'ok' }), false);
  assert.equal(
    validate({ status: 'down', service: 'teame507-preview' }),
    false,
  );
});
