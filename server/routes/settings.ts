import { Hono } from 'hono';
import { DB } from '@cloudflare/workers-types';

type Env = {
  DB: DB;
};

const app = new Hono<{ Bindings: Env }>();

// 获取所有设置
app.get('/', async (c) => {
  const settings = await c.env.DB.prepare('SELECT * FROM settings').all();
  return c.json({ settings: settings.results });
});

// 获取邮件用户列表
app.get('/mail-users', async (c) => {
  const users = await c.env.DB.prepare('SELECT * FROM mail_users WHERE status = 1 ORDER BY id DESC').all();
  return c.json({ users: users.results });
});

// 添加邮件用户
app.post('/mail-users', async (c) => {
  const { username, email } = await c.req.json();
  
  if (!username || !email) {
    return c.json({ error: '用户名和邮箱不能为空' }, 400);
  }
  
  const result = await c.env.DB.prepare(
    'INSERT INTO mail_users (username, email, status) VALUES (?, ?, 1)'
  ).bind(username, email).run();
  
  if (!result.success) {
    return c.json({ error: '添加用户失败' }, 500);
  }
  
  return c.json({ message: '添加用户成功' });
});

// 删除邮件用户
app.delete('/mail-users/:id', async (c) => {
  const id = c.req.param('id');
  
  const result = await c.env.DB.prepare('DELETE FROM mail_users WHERE id = ?').bind(id).run();
  
  if (!result.success) {
    return c.json({ error: '删除用户失败' }, 500);
  }
  
  return c.json({ message: '删除用户成功' });
});

// 更新邮件配置
app.put('/email', async (c) => {
  const emailConfig = await c.req.json();
  
  const settings = [
    { key: 'email_host', value: emailConfig.host || '' },
    { key: 'email_port', value: String(emailConfig.port || 465) },
    { key: 'email_user', value: emailConfig.user || '' },
    { key: 'email_password', value: emailConfig.password || '' },
    { key: 'email_template', value: emailConfig.template || '' },
  ];
  
  for (const setting of settings) {
    const existingSetting = await c.env.DB.prepare('SELECT id FROM settings WHERE key = ?').bind(setting.key).first();
    
    if (existingSetting) {
      await c.env.DB.prepare('UPDATE settings SET value = ?, updated = CURRENT_TIMESTAMP WHERE key = ?').bind(setting.value, setting.key).run();
    } else {
      await c.env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').bind(setting.key, setting.value).run();
    }
  }
  
  return c.json({ message: '保存邮件配置成功' });
});

// 获取单个设置
app.get('/:key', async (c) => {
  const key = c.req.param('key');
  const setting = await c.env.DB.prepare('SELECT * FROM settings WHERE key = ?').bind(key).first();
  
  if (!setting) {
    return c.json({ error: '设置不存在' }, 404);
  }
  
  return c.json({ setting });
});

// 创建或更新设置
app.post('/', async (c) => {
  const { key, value } = await c.req.json();
  
  const existingSetting = await c.env.DB.prepare('SELECT id FROM settings WHERE key = ?').bind(key).first();
  
  let result;
  if (existingSetting) {
    result = await c.env.DB.prepare('UPDATE settings SET value = ?, updated = CURRENT_TIMESTAMP WHERE key = ?').bind(value, key).run();
  } else {
    result = await c.env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').bind(key, value).run();
  }
  
  if (!result.success) {
    return c.json({ error: '保存设置失败' }, 500);
  }
  
  return c.json({ message: '保存设置成功' });
});

// 删除设置
app.delete('/:key', async (c) => {
  const key = c.req.param('key');
  
  const result = await c.env.DB.prepare('DELETE FROM settings WHERE key = ?').bind(key).run();
  
  if (!result.success) {
    return c.json({ error: '删除设置失败' }, 500);
  }
  
  return c.json({ message: '删除设置成功' });
});

export default app;
