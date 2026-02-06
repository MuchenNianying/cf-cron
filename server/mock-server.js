import http from 'http';
import { URL } from 'url';

// 模拟任务数据
const mockTasks = [
  {
    id: 1,
    name: '测试任务 1',
    spec: '0 * * * * *',
    url: 'https://example.com/api/test1',
    method: 'GET',
    headers: '{}',
    body: '{}',
    tag: '测试',
    remark: '第一个测试任务',
    status: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    next_run_at: new Date(Date.now() + 60000).toISOString()
  },
  {
    id: 2,
    name: '测试任务 2',
    spec: '0 0 * * * *',
    url: 'https://example.com/api/test2',
    method: 'POST',
    headers: '{"Content-Type": "application/json"}',
    body: '{"key": "value"}',
    tag: '生产',
    remark: '第二个测试任务',
    status: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    next_run_at: new Date(Date.now() + 3600000).toISOString()
  }
];

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // 解析请求路径
  const url = new URL(req.url, 'http://localhost:8787');
  const pathname = url.pathname;

  // 模拟登录接口
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        if (username === 'admin' && password === 'admin123') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            token: 'mock-token-123456',
            user: {
              id: 1,
              username: 'admin',
              is_admin: 1
            }
          }));
        } else {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: '用户名或密码错误' }));
        }
      } catch (error) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: '请求参数错误' }));
      }
    });
    return;
  }

  // 模拟任务列表接口
  if (pathname === '/api/tasks' && req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ tasks: mockTasks, total: mockTasks.length }));
    return;
  }

  // 模拟健康检查接口
  if (pathname === '/health' && req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // 404 处理
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: '接口不存在' }));
});

// 启动服务器
const PORT = 8787;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Mock 服务器运行在 http://127.0.0.1:${PORT}`);
  console.log('提供以下模拟接口:');
  console.log('- POST /api/auth/login - 登录接口 (admin/admin123)');
  console.log('- GET /api/tasks - 任务列表接口');
  console.log('- GET /health - 健康检查接口');
});

// 处理服务器错误
server.on('error', (error) => {
  console.error('服务器错误:', error);
});