import { Hono } from 'hono';
import { cors } from 'hono/cors';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import taskLogRoutes from './routes/task_logs';
import settingRoutes from './routes/settings';
import userRoutes from './routes/users';
import logsRoutes from './routes/logs';
import { Scheduler } from './services/scheduler';

const app = new Hono();

// CORS 中间件配置
app.use('*', cors({
  origin: '*', // 允许所有来源
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true
}));

// 验证 JWT
type EnvWithJWT = {
  SECRET_KEY: string;
};

const generateSalt = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let salt = '';
  for (let i = 0; i < 6; i++) {
    salt += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return salt;
};

const generateHash = async (password: string, salt: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
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
    
    // 解码 payload
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





// 认证路由（不需要认证）
app.route('/api/auth', authRoutes);





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

// 登录日志路由（所有认证用户都可以访问）
protectedRoutes.route('/logs', logsRoutes);

// 系统设置路由（仅管理员可以访问）
adminRoutes.route('/settings', settingRoutes);

// 用户路由（仅管理员可以访问）
adminRoutes.route('/users', userRoutes);

// 个人用户操作路由（所有认证用户都可以访问）
protectedRoutes.post('/users/change-password', async (c) => {
  const { old_password, new_password, confirm_password } = await c.req.json();
  
  // 验证参数
  if (!old_password || !new_password || !confirm_password) {
    return c.json({ error: '请填写所有密码字段' }, 400);
  }
  
  if (new_password !== confirm_password) {
    return c.json({ error: '两次输入的密码不一致' }, 400);
  }
  
  // 获取当前用户ID（从JWT token中获取）
  const user = c.get('user');
  if (!user || !user.id) {
    return c.json({ error: '用户未认证' }, 401);
  }
  
  const userId = user.id;
  
  // 获取用户信息
  const userInfo = await c.env.DB.prepare('SELECT id, password, salt FROM users WHERE id = ?').bind(userId).first();
  
  if (!userInfo) {
    return c.json({ error: '用户不存在' }, 404);
  }
  
  // 验证原密码
  const hashedOldPassword = await generateHash(old_password, userInfo.salt);
  if (hashedOldPassword !== userInfo.password) {
    return c.json({ error: '原密码错误' }, 400);
  }
  
  // 更新密码
  const salt = generateSalt();
  const hashedNewPassword = await generateHash(new_password, salt);
  
  const result = await c.env.DB.prepare(
    'UPDATE users SET password = ?, salt = ?, updated = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(hashedNewPassword, salt, userId).run();
  
  if (!result.success) {
    return c.json({ error: '密码修改失败' }, 500);
  }
  
  return c.json({ message: '密码修改成功' });
});

// 注册受保护的路由
app.route('/api', protectedRoutes);
app.route('/api', adminRoutes);

// 导出默认对象，包含 fetch 和 scheduled 方法
export default {
  async fetch(request: Request, env: any, ctx: any) {
    return app.fetch(request, env, ctx);
  },

  async scheduled(event: any, env: any, ctx: any) {
    console.log('=== 定时任务触发事件 ===');
    console.log('事件信息:', event);
    try {
      console.log('开始执行定时任务调度器...');
      
      // 检查必要的环境变量
      if (!env.DB) {
        console.error('数据库连接失败: env.DB 未定义');
        return;
      }
      
      if (!env.SECRET_KEY) {
        console.warn('SECRET_KEY 未定义，使用默认值');
        env.SECRET_KEY = 'default_secret';
      }
      
      console.log('环境变量检查通过');
      
      // 使用 Scheduler 类执行调度逻辑
      const scheduler = new Scheduler(env);
      await scheduler.run();
      
      console.log('定时任务调度器执行成功');
    } catch (error) {
      console.error('定时任务调度器执行失败:', error);
      if (error instanceof Error) {
        console.error('错误信息:', error.message);
        console.error('错误堆栈:', error.stack);
      }
    }
  },
};
