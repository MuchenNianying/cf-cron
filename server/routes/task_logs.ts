import { Hono } from 'hono';
import { DB } from '@cloudflare/workers-types';

type Env = {
  DB: DB;
  SECRET_KEY: string;
};

const app = new Hono<{ Bindings: Env }>();

// 验证 JWT
const verifyToken = async (token: string, secret: string): Promise<any> => {
  try {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
    
    // 验证签名
    const encoder = new TextEncoder();
    const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
    const secretKey = secret && secret.length > 0 ? secret : 'default_secret';
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secretKey),
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['verify']
    );
    
    const signatureBuffer = await crypto.subtle.verify(
      'HMAC',
      key,
      Uint8Array.from(atob(encodedSignature), c => c.charCodeAt(0)),
      data
    );
    
    if (!signatureBuffer) {
      throw new Error('Invalid signature');
    }
    
    // 解析 payload
    const payload = JSON.parse(atob(encodedPayload));
    
    // 验证过期时间
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      throw new Error('Token expired');
    }
    
    return payload;
  } catch (error) {
    throw new Error('Invalid token');
  }
};

// 管理员权限检查中间件
const requireAdmin = async (c: any, next: any) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return c.json({ error: '未授权' }, 401);
  }
  
  try {
    const secret = c.env.SECRET_KEY || 'default_secret';
    const payload = await verifyToken(token, secret);
    
    // 检查是否为管理员
    if (!payload.is_admin) {
      return c.json({ error: '需要管理员权限' }, 403);
    }
    
    // 将用户信息存储到上下文中
    c.set('user', payload);
    await next();
  } catch (error) {
    return c.json({ error: '无效的token' }, 401);
  }
};

// 获取任务日志列表
app.get('/', async (c) => {
  const { page = 1, pageSize = 20, page_size, task_id, name, status, protocol, start_time, end_time } = c.req.query();
  const actualPageSize = page_size || pageSize;
  
  let query = 'SELECT * FROM task_logs WHERE 1=1';
  const params: any[] = [];
  
  if (task_id) {
    query += ' AND task_id = ?';
    params.push(task_id);
  }
  
  if (name) {
    query += ' AND name LIKE ?';
    params.push('%' + name + '%');
  }
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  if (protocol) {
    query += ' AND protocol = ?';
    params.push(protocol);
  }
  
  if (start_time) {
    query += ' AND start_time >= ?';
    params.push(start_time);
  }
  
  if (end_time) {
    query += ' AND start_time <= ?';
    params.push(end_time);
  }
  
  query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(parseInt(actualPageSize), (parseInt(page) - 1) * parseInt(actualPageSize));
  
  const logs = await c.env.DB.prepare(query).bind(...params).all();
  const totalQuery = 'SELECT COUNT(*) as count FROM task_logs WHERE 1=1' + 
    (task_id ? ' AND task_id = ?' : '') + 
    (name ? ' AND name LIKE ?' : '') + 
    (status ? ' AND status = ?' : '') + 
    (protocol ? ' AND protocol = ?' : '') +
    (start_time ? ' AND start_time >= ?' : '') + 
    (end_time ? ' AND start_time <= ?' : '');
  const total = await c.env.DB.prepare(totalQuery).bind(...params.slice(0, params.length - 2)).first();
  
  return c.json({ logs: logs.results, total: total?.count || 0 });
});

// 获取任务日志详情
app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const log = await c.env.DB.prepare('SELECT * FROM task_logs WHERE id = ?').bind(id).first();
  
  if (!log) {
    return c.json({ error: '日志不存在' }, 404);
  }
  
  return c.json({ log });
});

// 清空任务日志（需要管理员权限）
app.delete('/clear', requireAdmin, async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM task_logs').run();
  
  if (!result.success) {
    return c.json({ error: '清空日志失败' }, 500);
  }
  
  return c.json({ message: '清空日志成功' });
});

// 删除指定时间前的任务日志（需要管理员权限）
app.delete('/remove', requireAdmin, async (c) => {
  const { months } = await c.req.json();
  const time = new Date();
  time.setMonth(time.getMonth() - months);
  
  const result = await c.env.DB.prepare('DELETE FROM task_logs WHERE start_time <= ?').bind(time.toISOString()).run();
  
  if (!result.success) {
    return c.json({ error: '删除日志失败' }, 500);
  }
  
  return c.json({ message: '删除日志成功' });
});

// 删除选中的任务日志（需要管理员权限）
app.delete('/batch', requireAdmin, async (c) => {
  const { ids } = await c.req.json();
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return c.json({ error: '请选择要删除的日志' }, 400);
  }
  
  const placeholders = ids.map(() => '?').join(',');
  const result = await c.env.DB.prepare(`DELETE FROM task_logs WHERE id IN (${placeholders})`).bind(...ids).run();
  
  if (!result.success) {
    return c.json({ error: '删除日志失败' }, 500);
  }
  
  return c.json({ message: '删除日志成功' });
});

export default app;
