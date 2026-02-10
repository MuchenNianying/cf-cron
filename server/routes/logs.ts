import { Hono } from 'hono';
import { DB } from '@cloudflare/workers-types';

type Env = {
  DB: DB;
  SECRET_KEY: string;
};

const app = new Hono<{ Bindings: Env }>();

// 获取登录日志列表
app.get('/login-logs', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('page_size') || '10');
    const offset = (page - 1) * pageSize;
    
    // 获取登录日志总数
    const countResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM login_logs'
    ).first();
    const total = countResult?.total || 0;
    
    // 获取登录日志列表
    const logs = await c.env.DB.prepare(
      'SELECT id, username, ip, login_time FROM login_logs ORDER BY login_time DESC LIMIT ? OFFSET ?'
    ).bind(pageSize, offset).all();
    
    return c.json({
      logs: logs.results || [],
      total,
      page,
      page_size: pageSize
    });
  } catch (error) {
    console.error('获取登录日志失败:', error);
    return c.json({ error: '获取登录日志失败' }, 500);
  }
});

export default app;