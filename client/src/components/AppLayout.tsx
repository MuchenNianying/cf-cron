import { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, message, Button, Modal, Form, Input } from 'antd';
import { 
  ClockCircleOutlined, 
  FileTextOutlined, 
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  EditOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';

const { Header, Content, Sider } = Layout;

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordForm] = Form.useForm();
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    message.success('退出登录成功');
    navigate('/login');
  };

  const handleChangePassword = async (values: any) => {
    setPasswordLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();
      
      if (response.ok) {
        message.success('密码修改成功');
        setPasswordModalVisible(false);
        passwordForm.resetFields();
      } else {
        message.error(data.error || '密码修改失败');
      }
    } catch (err) {
      message.error('网络错误，请稍后重试');
    } finally {
      setPasswordLoading(false);
    }
  };

  const menuItems = [
    {
      key: '/tasks',
      icon: <ClockCircleOutlined />,
      label: '任务管理',
    },
    {
      key: '/logs',
      icon: <FileTextOutlined />,
      label: '任务日志',
    },
    ...(user?.is_admin === 1 ? [
      {
        key: '/settings',
        icon: <SettingOutlined />,
        label: '系统设置',
      },
      {
        key: '/users',
        icon: <UserOutlined />,
        label: '用户管理',
      },
    ] : []),
  ];

  const userMenuItems = [
    {
      key: 'change-password',
      icon: <EditOutlined />,
      label: '修改密码',
      onClick: () => setPasswordModalVisible(true),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  return (
    <>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider 
          collapsible 
          collapsed={collapsed} 
          onCollapse={setCollapsed}
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
          }}
        >
          <div style={{ 
            height: '64px', 
            margin: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #f0f0f0'
          }}>
            <h2 style={{ 
              color: '#fff', 
              margin: 0,
              fontSize: collapsed ? '18px' : '20px'
            }}>
              {collapsed ? 'CF' : 'CF-Cron'}
            </h2>
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={handleMenuClick}
          />
        </Sider>
        <Layout style={{ marginLeft: collapsed ? '80px' : '200px' }}>
          <Header style={{ 
            padding: '0 24px', 
            background: '#fff',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
              定时任务管理系统
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <div style={{ 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  transition: 'background-color 0.3s'
                }}>
                  <Avatar 
                    icon={<UserOutlined />} 
                    style={{ 
                      marginRight: '8px',
                      backgroundColor: '#1890ff'
                    }} 
                  />
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>
                    {user?.name || '用户'}
                  </span>
                </div>
              </Dropdown>
            </div>
          </Header>
          <Content style={{ 
            margin: '16px',
            padding: 0,
            minHeight: 'calc(100vh - 96px)'
          }}>
            {children}
          </Content>
        </Layout>
      </Layout>

      {/* 修改密码模态框 */}
      <Modal
        title="修改密码"
        open={passwordModalVisible}
        onCancel={() => setPasswordModalVisible(false)}
        footer={null}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handleChangePassword}
        >
          <Form.Item
            name="old_password"
            label="原密码"
            rules={[{ required: true, message: '请输入原密码' }]}
          >
            <Input.Password placeholder="请输入原密码" />
          </Form.Item>
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[{ required: true, message: '请输入新密码' }]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="确认新密码"
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请确认新密码" />
          </Form.Item>
          <Form.Item>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Button onClick={() => setPasswordModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={passwordLoading}>
                确定
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default AppLayout;