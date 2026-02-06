import { Hono } from 'hono';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import taskLogRoutes from './routes/task_logs';
import settingRoutes from './routes/settings';
import userRoutes from './routes/users';
import { Scheduler } from './services/scheduler';

const app = new Hono();

// 验证 JWT
type EnvWithJWT = {
  SECRET_KEY: string;
};

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

// 健康检查
app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// 测试端点
app.post('/test', async (c) => {
  try {
    const body = await c.req.json();
    return c.json({ message: '测试成功', data: body });
  } catch (error) {
    return c.json({ error: '测试失败' }, 500);
  }
});

// 数据库测试端点
app.get('/test-db', async (c) => {
  try {
    // 检查数据库连接
    if (!c.env.DB) {
      return c.json({ error: '数据库连接失败' }, 500);
    }
    
    // 测试查询用户表
    const users = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
    
    // 测试查询任务表
    const tasks = await c.env.DB.prepare('SELECT COUNT(*) as count FROM tasks').first();
    
    return c.json({
      status: 'ok',
      database: 'connected',
      users: users,
      tasks: tasks
    });
  } catch (error) {
    return c.json({ error: '数据库测试失败' }, 500);
  }
});

// 认证路由（不需要认证）
app.route('/api/auth', authRoutes);

// 任务调度器触发点（不需要认证，用于测试 Cron Trigger）
app.get('/api/scheduler/run', async (c) => {
  try {
    const scheduler = new Scheduler(c.env);
    await scheduler.run();
    return c.json({ message: '调度器执行成功' });
  } catch (error) {
    return c.json({ error: '调度器执行失败' }, 500);
  }
});

// 测试定时任务触发点（模拟 Cloudflare Cron Trigger）
app.get('/api/scheduler/test', async (c) => {
  try {
    // 直接调用 scheduled 函数的逻辑
    const scheduler = new Scheduler(c.env);
    await scheduler.run();
    
    return c.json({ message: '定时任务触发测试成功' });
  } catch (error) {
    return c.json({ error: '定时任务触发测试失败' }, 500);
  }
});

// 需要认证的路由
const protectedRoutes = new Hono();
protectedRoutes.use('*', async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return c.json({ error: '未授权' }, 401);
  }
  
  try {
      const secret = c.env.SECRET_KEY || 'default_secret';
      const payload = await verifyToken(token, secret);
    
    // 将用户信息存储到上下文中
    c.set('user', payload);
    await next();
  } catch (error) {
    return c.json({ error: '无效的token' }, 401);
  }
});

// 需要管理员权限的路由
const adminRoutes = new Hono();
adminRoutes.use('*', async (c, next) => {
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
});

// 任务路由（所有认证用户都可以访问）
protectedRoutes.route('/tasks', taskRoutes);

// 任务日志路由（所有认证用户都可以访问）
protectedRoutes.route('/task-logs', taskLogRoutes);

// 系统设置路由（仅管理员可以访问）
adminRoutes.route('/settings', settingRoutes);

// 用户路由（仅管理员可以访问）
adminRoutes.route('/users', userRoutes);

// 注册受保护的路由
app.route('/api', protectedRoutes);
app.route('/api', adminRoutes);

// Cron Trigger 处理函数
export async function scheduled(event: any, env: any, ctx: any) {
  console.log('=== 定时任务触发事件 ===');
  console.log('事件信息:', event);
  try {
    console.log('开始执行定时任务调度器...');
    
    // 直接执行调度器逻辑，不依赖于 Scheduler 类
    const now = new Date();
    console.log(`调度器运行时间: ${now.toISOString()}`);
    
    // 获取所有启用的任务
    const tasks = await env.DB.prepare(
      'SELECT id, name, spec, protocol, command, http_method, timeout, retry_times, retry_interval, request_headers, request_body FROM tasks WHERE status = 1'
    ).all();
    
    console.log(`找到 ${tasks.results?.length || 0} 个启用的任务`);
    
    console.log('定时任务调度器执行成功');
  } catch (error) {
    console.error('定时任务调度器执行失败:', error);
  }
}

export default app;
