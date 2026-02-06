import { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { apiRequest } from '../../config/api';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username || !password) {
      message.error('请输入用户名和密码');
      return;
    }

    setLoading(true);

    try {
      const data = await apiRequest('auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      message.success('登录成功');
      window.location.href = '/tasks';
    } catch (err: any) {
      message.error(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f0f2f5'
    }}>
      <div style={{ 
        width: '400px',
        backgroundColor: '#fff',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        padding: '40px'
      }}>
        <h2 style={{ 
          textAlign: 'center', 
          marginBottom: '30px',
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#303133'
        }}>
          用户登录
        </h2>
        
        <Form layout="vertical">
          <Form.Item label="用户名">
            <Input
              prefix={<UserOutlined />}
              placeholder="请输入用户名或邮箱"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onPressEnter={handleSubmit}
            />
          </Form.Item>

          <Form.Item label="密码">
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onPressEnter={handleSubmit}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              block
              loading={loading}
              onClick={handleSubmit}
              style={{ height: '40px' }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
};

export default Login;
