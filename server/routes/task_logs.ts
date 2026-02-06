import { Hono } from 'hono';
import { DB } from '@cloudflare/workers-types';

type Env = {
  DB: DB;
};

const app = new Hono<{ Bindings: Env }>();

// 获取任务日志列表
app.get('/', async (c) => {
  const { page = 1, pageSize = 20, task_id, status, protocol, start_time, end_time } = c.req.query();
  
  let query = 'SELECT * FROM task_logs WHERE 1=1';
  const params: any[] = [];
  
  if (task_id) {
    query += ' AND task_id = ?';
    params.push(task_id);
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
  params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
  
  const logs = await c.env.DB.prepare(query).bind(...params).all();
  const totalQuery = 'SELECT COUNT(*) as count FROM task_logs WHERE 1=1' + 
    (task_id ? ' AND task_id = ?' : '') + 
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

// 清空任务日志
app.delete('/clear', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM task_logs').run();
  
  if (!result.success) {
    return c.json({ error: '清空日志失败' }, 500);
  }
  
  return c.json({ message: '清空日志成功' });
});

// 删除指定时间前的任务日志
app.delete('/remove', async (c) => {
  const { months } = await c.req.json();
  const time = new Date();
  time.setMonth(time.getMonth() - months);
  
  const result = await c.env.DB.prepare('DELETE FROM task_logs WHERE start_time <= ?').bind(time.toISOString()).run();
  
  if (!result.success) {
    return c.json({ error: '删除日志失败' }, 500);
  }
  
  return c.json({ message: '删除日志成功' });
});

export default app;
