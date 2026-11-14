const button = document.querySelector('#health-check');
const status = document.querySelector('#health-status');

button.addEventListener('click', async () => {
  button.disabled = true;
  status.dataset.state = 'loading';
  status.textContent = '正在连接本地预览服务…';

  try {
    const response = await fetch('/api/health', {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('Health check failed');
    const result = await response.json();
    if (result.status !== 'ok') throw new Error('Preview is not ready');
    status.dataset.state = 'success';
    status.textContent = '连接成功。开发环境已就绪，可以开始构建 Demo。';
  } catch {
    status.dataset.state = 'error';
    status.textContent = '暂时无法连接，请确认本地预览服务正在运行后重试。';
  } finally {
    button.disabled = false;
  }
});
