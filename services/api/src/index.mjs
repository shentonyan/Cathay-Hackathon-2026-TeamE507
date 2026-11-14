import { getHealth } from './modules/health/get-health.mjs';

// Public entry point for local composition. / 本地组合使用的公开接口。
export function handleApiRequest(request, response) {
  if ((request.url ?? '/').split('?')[0] !== '/api/health') return false;
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, {
      Allow: 'GET, HEAD',
      'Content-Type': 'text/plain; charset=utf-8',
    });
    response.end('Method not allowed');
    return true;
  }
  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(
    request.method === 'HEAD' ? undefined : JSON.stringify(getHealth()),
  );
  return true;
}
