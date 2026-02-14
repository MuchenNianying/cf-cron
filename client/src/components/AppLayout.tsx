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
import { apiRequest } from './../config/api';

const { Header, Content, Sider } = Layout;

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [userInfoModalVisible, setUserInfoModalVisible] = useState(false);
  const [passwordForm] = Form.useForm();
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      console.log('用户信息:', parsedUser);
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
      await apiRequest('users/change-password', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      message.success('密码修改成功');
      setPasswordModalVisible(false);
      passwordForm.resetFields();
    } catch (err: any) {
      message.error(err.message || '密码修改失败');
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
        key: '/logs/login',
        icon: <UserOutlined />,
        label: '登录日志',
      },
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
      key: 'user-info',
      icon: <UserOutlined />,
      label: '用户信息',
      onClick: () => setUserInfoModalVisible(true),
    },
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
        <Layout style={{ marginLeft: collapsed ? '80px' : '200px', minWidth: '100%' }}>
          <Header style={{ 
            padding: '0 24px', 
            background: '#fff',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            minWidth: '100%'
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
                  transition: 'background-color 0.3s',
                  whiteSpace: 'nowrap'
                }}>
                  <Avatar 
                    icon={<UserOutlined />} 
                    style={{ 
                      marginRight: '8px',
                      backgroundColor: '#1890ff'
                    }} 
                  />
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>
                    {user?.username || '用户'}
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

      {/* 用户信息对话框 */}
      <Modal
        title="用户信息"
        open={userInfoModalVisible}
        onCancel={() => setUserInfoModalVisible(false)}
        footer={[
          <Button key="ok" type="primary" onClick={() => setUserInfoModalVisible(false)}>
            确定
          </Button>,
        ]}
        width={400}
      >
        {user && (
          <div style={{ lineHeight: '2.5' }}>
            <p><strong>用户名：</strong>{user.username}</p>
            <p><strong>邮箱：</strong>{user.email}</p>
            <p><strong>角色：</strong>{user.is_admin ? '管理员' : '普通用户'}</p>
          </div>
        )}
      </Modal>
    </>
  );
};

export default AppLayout;