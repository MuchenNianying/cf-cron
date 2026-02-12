import { Hono } from 'hono';
import { DB } from '@cloudflare/workers-types';
import cronParser from 'cron-parser';
import { Scheduler } from '../services/scheduler';

type Env = {
  DB: DB;
};

const app = new Hono<{ Bindings: Env }>();

// 检查管理员权限的中间件
const requireAdmin = async (c: any, next: any) => {
  const user = c.get('user');
  if (!user || !user.is_admin) {
    return c.json({ error: '需要管理员权限' }, 403);
  }
  await next();
};

// 获取任务列表（所有认证用户都可以访问）
app.get('/', async (c) => {
  const { page = 1, pageSize = 20, page_size, name, status, protocol, tag } = c.req.query();
  const actualPageSize = page_size || pageSize;
  
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params: any[] = [];
  
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
  
  if (tag) {
    query += ' AND tag = ?';
    params.push(tag);
  }
  
  query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(parseInt(actualPageSize), (parseInt(page) - 1) * parseInt(actualPageSize));
  
  const tasks = await c.env.DB.prepare(query).bind(...params).all();
  
  // 计算每个任务的下次执行时间
  const enrichedTasks = (tasks.results || []).map((task: any) => {
    if (task.spec) {
      try {
        // 检查 cron 表达式是否是 6 位格式（包含秒字段）
        const cronParts = task.spec.trim().split(/\s+/);
        let specToParse = task.spec;
        
        if (cronParts.length === 6) {
          // 6 位格式：秒 分 时 日 月 星期
          // cron-parser 默认支持 5 位格式，需要跳过秒字段
          specToParse = cronParts.slice(1).join(' ');
        } else if (cronParts.length === 5) {
          // 5 位格式：分 时 日 月 星期
          specToParse = task.spec;
        }
        
        const interval = cronParser.parseExpression(specToParse, { tz: 'Asia/Shanghai' });
        task.next_run_at = interval.next().toDate().toISOString();
      } catch (e) {
        task.next_run_at = '无效表达式';
      }
    } else {
      task.next_run_at = 'N/A';
    }
    return task;
  });
  
  let totalQuery = 'SELECT COUNT(*) as count FROM tasks WHERE 1=1';
  const totalParams: any[] = [];
  
  if (name) {
    totalQuery += ' AND name LIKE ?';
    totalParams.push('%' + name + '%');
  }
  
  if (status) {
    totalQuery += ' AND status = ?';
    totalParams.push(status);
  }
  
  if (protocol) {
    totalQuery += ' AND protocol = ?';
    totalParams.push(protocol);
  }
  
  if (tag) {
    totalQuery += ' AND tag = ?';
    totalParams.push(tag);
  }
  
  const total = await c.env.DB.prepare(totalQuery).bind(...totalParams).first();  
  return c.json({ tasks: enrichedTasks, total: total?.count || 0 });
});

// 获取任务详情（所有认证用户都可以访问）
app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();  
  if (!task) {
    return c.json({ error: '任务不存在' }, 404);
  }
  
  // 计算下次执行时间
  if (task.spec) {
    try {
      // 检查 cron 表达式是否是 6 位格式（包含秒字段）
      const cronParts = task.spec.trim().split(/\s+/);
      let specToParse = task.spec;
      
      if (cronParts.length === 6) {
        // 6 位格式：秒 分 时 日 月 星期
        // cron-parser 默认支持 5 位格式，需要跳过秒字段
        specToParse = cronParts.slice(1).join(' ');
      } else if (cronParts.length === 5) {
        // 5 位格式：分 时 日 月 星期
        specToParse = task.spec;
      }
      
      const interval = cronParser.parseExpression(specToParse, { utc: true });
      task.next_run_at = interval.next().toDate().toISOString();
    } catch (e) {
      task.next_run_at = '无效表达式';
    }
  } else {
    task.next_run_at = 'N/A';
  }
  
  return c.json({ task });
});

// 创建任务（仅管理员可以访问）
app.post('/', requireAdmin, async (c) => {
  const task = await c.req.json();  
  const result = await c.env.DB.prepare(
    'INSERT INTO tasks (name, dependency_task_id, dependency_status, spec, protocol, command, http_method, timeout, multi, retry_times, retry_interval, notify_status, notify_type, notify_receiver_id, notify_keyword, tag, remark, status, request_headers, request_body) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    task.name,
    task.dependency_task_id || '',
    task.dependency_status || 1,
    task.spec,
    task.protocol,
    task.command,
    task.http_method || 1,
    task.timeout || 0,
    task.multi || 1,
    task.retry_times || 0,
    task.retry_interval || 0,
    task.notify_status || 1,
    task.notify_type || 0,
    task.notify_receiver_id || '',
    task.notify_keyword || '',
    task.tag || '',
    task.remark || '',
    task.status || 0,
    task.request_headers || '',
    task.request_body || ''
  ).run();  
  if (!result.success) {
    return c.json({ error: '创建任务失败' }, 500);
  }
  
  // 更新任务缓存
  try {
    const scheduler = new Scheduler(c.env);
    await scheduler.updateTaskCache();
  } catch (error) {
    // 静默处理错误
  }
  
  return c.json({ message: '创建任务成功' });
});

// 更新任务（仅管理员可以访问）
app.put('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const task = await c.req.json();  
  const result = await c.env.DB.prepare(
    'UPDATE tasks SET name = ?, dependency_task_id = ?, dependency_status = ?, spec = ?, protocol = ?, command = ?, http_method = ?, timeout = ?, multi = ?, retry_times = ?, retry_interval = ?, notify_status = ?, notify_type = ?, notify_receiver_id = ?, notify_keyword = ?, tag = ?, remark = ?, status = ?, request_headers = ?, request_body = ? WHERE id = ?'
  ).bind(
    task.name,
    task.dependency_task_id || '',
    task.dependency_status || 1,
    task.spec,
    task.protocol,
    task.command,
    task.http_method || 1,
    task.timeout || 0,
    task.multi || 1,
    task.retry_times || 0,
    task.retry_interval || 0,
    task.notify_status || 1,
    task.notify_type || 0,
    task.notify_receiver_id || '',
    task.notify_keyword || '',
    task.tag || '',
    task.remark || '',
    task.status || 0,
    task.request_headers || '',
    task.request_body || '',
    id
  ).run();  
  if (!result.success) {
    return c.json({ error: '更新任务失败' }, 500);
  }
  
  // 更新任务缓存
  try {
    const scheduler = new Scheduler(c.env);
    await scheduler.updateTaskCache();
  } catch (error) {
    // 静默处理错误
  }
  
  return c.json({ message: '更新任务成功' });
});

// 删除任务（仅管理员可以访问）
app.delete('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  
  const result = await c.env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();  
  if (!result.success) {
    return c.json({ error: '删除任务失败' }, 500);
  }
  
  // 更新任务缓存
  try {
    const scheduler = new Scheduler(c.env);
    await scheduler.updateTaskCache();
  } catch (error) {
    // 静默处理错误
  }
  
  return c.json({ message: '删除任务成功' });
});

// 启用任务（所有认证用户都可以访问）
app.post('/:id/enable', async (c) => {
  const id = c.req.param('id');
  
  const result = await c.env.DB.prepare('UPDATE tasks SET status = 1 WHERE id = ?').bind(id).run();  
  if (!result.success) {
    return c.json({ error: '启用任务失败' }, 500);
  }
  
  // 更新任务缓存
  try {
    const scheduler = new Scheduler(c.env);
    await scheduler.updateTaskCache();
  } catch (error) {
    // 静默处理错误
  }
  
  return c.json({ message: '启用任务成功' });
});

// 禁用任务（所有认证用户都可以访问）
app.post('/:id/disable', async (c) => {
  const id = c.req.param('id');
  
  const result = await c.env.DB.prepare('UPDATE tasks SET status = 0 WHERE id = ?').bind(id).run();  
  if (!result.success) {
    return c.json({ error: '禁用任务失败' }, 500);
  }
  
  // 更新任务缓存
  try {
    const scheduler = new Scheduler(c.env);
    await scheduler.updateTaskCache();
  } catch (error) {
    // 静默处理错误
  }
  
  return c.json({ message: '禁用任务成功' });
});

// 手动执行任务（所有认证用户都可以访问）
app.post('/:id/run', async (c) => {
  const id = c.req.param('id');
  
  const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();
  if (!task) {
    return c.json({ error: '任务不存在' }, 404);
  }
  
  try {
    let result = '';
    let status = 2;
    let total_time = 0;
    
    const startTime = new Date();
    
    if (task.protocol === 1) {
      const url = task.command;
      const method = task.http_method === 1 ? 'GET' : 'POST';
      
      const options: RequestInit = {
        method,
      };

      if (task.request_headers) {
        try {
          const headers = JSON.parse(task.request_headers);
          options.headers = headers;
        } catch (error) {
          console.error(`解析请求头失败:`, error);
        }
      }

      if (method === 'POST' && task.request_body) {
        options.body = task.request_body;
      }
      
      const response = await fetch(url, options);
      
      const endTime = new Date();
      total_time = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
      
      if (response.ok) {
        result = await response.text();
      } else {
        status = 0;
        result = `HTTP Error: ${response.status}`;
      }
    } else {
      result = '命令执行功能暂未实现';
      status = 0;
    }
    
    const logResult = await c.env.DB.prepare(
      'INSERT INTO task_logs (task_id, name, spec, protocol, command, timeout, retry_times, start_time, end_time, status, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      id,
      task.name,
      task.spec,
      task.protocol,
      task.command,
      task.timeout || 0,
      0,
      startTime.toISOString(),
      new Date().toISOString(),
      status,
      result
    ).run();
    
    if (!logResult.success) {
      return c.json({ error: '记录日志失败' }, 500);
    }
    
    return c.json({ message: '任务执行成功' });
  } catch (error) {
    console.error('任务执行失败:', error);
    return c.json({ error: '任务执行失败' }, 500);
  }
});

// 刷新任务缓存（所有认证用户都可以访问）
app.post('/cache/refresh', async (c) => {
  try {
    const scheduler = new Scheduler(c.env);
    await scheduler.updateTaskCache();
    return c.json({ message: '任务缓存刷新成功' });
  } catch (error) {
    console.error('任务缓存刷新失败:', error);
    return c.json({ error: '任务缓存刷新失败' }, 500);
  }
});

// 查询任务缓存（所有认证用户都可以访问）
app.get('/cache', async (c) => {
  try {
    const scheduler = new Scheduler(c.env);
    // 获取缓存信息
    const cacheInfo = scheduler.getCacheInfo();
    
    // 检查缓存是否过期，如果过期则更新
    if (cacheInfo.isExpired) {
      await scheduler.updateTaskCache();
    }
    
    // 重新获取更新后的缓存信息
    const updatedCacheInfo = scheduler.getCacheInfo();
    
    return c.json({ 
      message: '查询任务缓存成功',
      cacheInfo: {
        taskCount: updatedCacheInfo.taskCount,
        lastUpdated: new Date(updatedCacheInfo.lastUpdated).toISOString(),
        isExpired: updatedCacheInfo.isExpired
      }
    });
  } catch (error) {
    console.error('查询任务缓存失败:', error);
    return c.json({ error: '查询任务缓存失败' }, 500);
  }
});

export default app;
