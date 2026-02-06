import { Hono } from 'hono';
import { DB } from '@cloudflare/workers-types';

type Env = {
  DB: DB;
};

const app = new Hono<{ Bindings: Env }>();

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

app.get('/', async (c) => {
  const users = await c.env.DB.prepare('SELECT id, name, email, is_admin, status, created, updated FROM users ORDER BY id DESC').all();
  return c.json({ users: users.results });
});

app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = await c.env.DB.prepare('SELECT id, name, email, is_admin, status, created, updated FROM users WHERE id = ?').bind(id).first();
  
  if (!user) {
    return c.json({ error: '用户不存在' }, 404);
  }
  
  return c.json({ user });
});

app.post('/', async (c) => {
  const { name, password, email, is_admin, status } = await c.req.json();
  
  if (!name || !password) {
    return c.json({ error: '用户名和密码不能为空' }, 400);
  }
  
  const salt = generateSalt();
  const hashedPassword = await generateHash(password, salt);
  
  const result = await c.env.DB.prepare(
    'INSERT INTO users (name, password, salt, email, is_admin, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(name, hashedPassword, salt, email || '', is_admin || 0, status || 1).run();
  
  if (!result.success) {
    return c.json({ error: '创建用户失败' }, 500);
  }
  
  return c.json({ message: '创建用户成功' });
});

app.put('/:id', async (c) => {
  const id = c.req.param('id');
  const { name, password, email, is_admin, status } = await c.req.json();
  
  let result;
  if (password) {
    const salt = generateSalt();
    const hashedPassword = await generateHash(password, salt);
    result = await c.env.DB.prepare(
      'UPDATE users SET name = ?, password = ?, salt = ?, email = ?, is_admin = ?, status = ?, updated = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(name, hashedPassword, salt, email || '', is_admin || 0, status || 1, id).run();
  } else {
    result = await c.env.DB.prepare(
      'UPDATE users SET name = ?, email = ?, is_admin = ?, status = ?, updated = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(name, email || '', is_admin || 0, status || 1, id).run();
  }
  
  if (!result.success) {
    return c.json({ error: '更新用户失败' }, 500);
  }
  
  return c.json({ message: '更新用户成功' });
});

app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  
  const result = await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  
  if (!result.success) {
    return c.json({ error: '删除用户失败' }, 500);
  }
  
  return c.json({ message: '删除用户成功' });
});

app.post('/change-password', async (c) => {
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

export default app;
