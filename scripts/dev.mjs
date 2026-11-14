import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { getPreviewConfig } from './preview/config.mjs';
import { createPreviewServer } from './preview/server.mjs';

try {
  loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

try {
  const { host, port } = getPreviewConfig(process.env);
  const server = createPreviewServer();
  server.on('error', (error) => {
    console.error(`Preview failed / 预览启动失败 (${error.code}).`);
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    console.log(`Team E507 preview / 预览: http://${host}:${port}`);
    console.log('Press Ctrl+C to stop / 按 Ctrl+C 停止。');
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
