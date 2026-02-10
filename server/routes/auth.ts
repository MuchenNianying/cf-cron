import { Hono } from 'hono';
import { DB } from '@cloudflare/workers-types';

type Env = {
  DB: DB;
  SECRET_KEY: string;
};

const app = new Hono<{ Bindings: Env }>();

// 生成密码哈希
const generateHash = async (password: string, salt: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
};

// 生成 JWT
const generateToken = async (payload: any, secret: string): Promise<string> => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 86400 }));
  
  const encoder = new TextEncoder();
  const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
  const secretKey = secret && secret.length > 0 ? secret : 'default_secret';
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const encodedSignature = btoa(String.fromCharCode(...signatureArray));
  
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
};

// 登录
app.post('/login', async (c) => {
  try {
    // 检查请求体
    const body = await c.req.json();
    
    const { username, password } = body;
    
    if (!username || !password) {
      return c.json({ error: '用户名和密码不能为空' }, 400);
    }
    
    // 从数据库中查询用户
    const user = await c.env.DB.prepare(
      'SELECT id, name, password, salt, email, is_admin, status FROM users WHERE name = ? OR email = ?'
    ).bind(username, username).first();
    
    if (!user) {
      return c.json({ error: '用户名或密码错误' }, 401);
    }
    
    // 验证用户是否被禁用
    if (user.status !== 1) {
      return c.json({ error: '用户已被禁用' }, 401);
    }
    
    // 验证密码
    const hashedPassword = await generateHash(password, user.salt);
    if (hashedPassword !== user.password) {
      return c.json({ error: '用户名或密码错误' }, 401);
    }
    
    // 生成 JWT token
    const token = await generateToken(
      { id: user.id, name: user.name, email: user.email, is_admin: user.is_admin },
      c.env.SECRET_KEY
    );
    
    // 返回 token 和用户信息
    return c.json({
      token,
      user: {
        id: user.id,
        username: user.name,
        email: user.email,
        is_admin: user.is_admin
      }
    });
  } catch (error) {
    try {
      console.error('登录错误:', error);
    } catch (logError) {
      // 忽略日志错误
    }
    try {
      return c.json({ error: '登录失败，请稍后重试' }, 500);
    } catch (responseError) {
      // 如果 c.json() 失败，尝试使用基本的响应方法
      return new Response(JSON.stringify({ error: '登录失败，请稍后重试' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
});

// 注册
app.post('/register', async (c) => {
  try {
    const { name, password, email } = await c.req.json();
    
    // 检查用户名是否已存在
    const existingUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE name = ? OR email = ?'
    ).bind(name, email).first();
    
    if (existingUser) {
      return c.json({ error: '用户名或邮箱已存在' }, 400);
    }
    
    const salt = Math.random().toString(36).substring(2, 8);
    const hashedPassword = await generateHash(password, salt);
    
    const result = await c.env.DB.prepare(
      'INSERT INTO users (name, password, salt, email, is_admin, status) VALUES (?, ?, ?, ?, 0, 1)'
    ).bind(name, hashedPassword, salt, email).run();
    
    if (!result.success) {
      return c.json({ error: '注册失败' }, 500);
    }
    
    return c.json({ message: '注册成功' });
  } catch (error) {
    return c.json({ error: '注册失败，请稍后重试' }, 500);
  }
});

export default app;
