import { checkHealth } from './features/health/check-health.js';

const button = document.querySelector('#health-check');
const status = document.querySelector('#health-status');

button.addEventListener('click', async () => {
  button.disabled = true;
  status.dataset.state = 'loading';
  status.textContent = '正在连接 / Connecting…';

  try {
    await checkHealth();
    status.dataset.state = 'success';
    status.textContent = '连接成功，环境已就绪 / Connected. Ready to build.';
  } catch {
    status.dataset.state = 'error';
    status.textContent =
      '连接失败，请确认预览服务正在运行 / Connection failed. Check the preview server.';
  } finally {
    button.disabled = false;
  }
});
