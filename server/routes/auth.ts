import { Hono } from 'hono';
import { DB } from '@cloudflare/workers-types';

type Env = {
  DB: DB;
  JWT_SECRET: string;
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
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
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
  const { username, password } = await c.req.json();
  
  const user = await c.env.DB.prepare(
    'SELECT id, name, password, salt, email, is_admin, status FROM users WHERE (name = ? OR email = ?) AND status = 1'
  ).bind(username, username).first();
  
  if (!user) {
    return c.json({ error: '用户不存在或被禁用' }, 401);
  }
  
  const hashedPassword = await generateHash(password, user.salt);
  
  if (hashedPassword !== user.password) {
    return c.json({ error: '密码错误' }, 401);
  }
  
  const token = await generateToken(
    { id: user.id, name: user.name, is_admin: user.is_admin },
    c.env.JWT_SECRET || 'default_secret'
  );
  
  return c.json({ token, user: { id: user.id, name: user.name, email: user.email, is_admin: user.is_admin } });
});

// 注册
app.post('/register', async (c) => {
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
});

export default app;
