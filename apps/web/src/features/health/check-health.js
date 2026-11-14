export async function checkHealth() {
  const response = await fetch('/api/health', {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('Health check failed / 健康检查失败');
  const result = await response.json();
  if (result.status !== 'ok')
    throw new Error('Preview is not ready / 预览尚未就绪');
  return result;
}
