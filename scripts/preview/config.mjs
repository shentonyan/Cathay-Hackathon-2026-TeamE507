export function getPreviewConfig(environment) {
  const rawPort = environment.PORT ?? '3000';
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || port < 1 || port > 65535) {
    throw new Error('PORT must be 1–65535 / PORT 必须为 1–65535 的整数。');
  }
  return { host: '127.0.0.1', port };
}
