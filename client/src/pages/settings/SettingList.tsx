import { useState, useEffect } from 'react';
import { Table, Button, Form, Input, message, Modal, Space, Tabs, Tag, Card, Row, Col } from 'antd';
import { ReloadOutlined, EditOutlined, PlusOutlined, MailOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiRequest } from '../../config/api';

interface Setting {
  id: number;
  key: string;
  value: string;
  created: string;
  updated: string;
}

const SettingList = () => {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('notification');
  const [emailConfig, setEmailConfig] = useState({
    host: '',
    port: 465,
    user: '',
    password: '',
    template: ''
  });
  const [mailUsers, setMailUsers] = useState<any[]>([]);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: ''
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('settings');
      setSettings(data.settings);
    } catch (err: any) {
      message.error(err.message || '获取设置失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchMailUsers = async () => {
    try {
      const data = await apiRequest('settings/mail-users');
      setMailUsers(data.users || []);
    } catch (err: any) {
      console.error('获取邮件用户失败:', err);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchMailUsers();
  }, []);

  const handleRefresh = () => {
    fetchSettings();
    message.success('刷新成功');
  };

  const handleUpdateSetting = async (key: string, value: string) => {
    try {
      await apiRequest('settings', {
        method: 'PUT',
        body: JSON.stringify({ key, value }),
      });
      message.success('更新成功');
      fetchSettings();
    } catch (err: any) {
      message.error(err.message || '更新失败');
    }
  };

  const handleSaveEmailConfig = async () => {
    try {
      await apiRequest('settings/email', {
        method: 'PUT',
        body: JSON.stringify(emailConfig),
      });
      message.success('保存成功');
    } catch (err: any) {
      message.error(err.message || '保存失败');
    }
  };

  const handleAddMailUser = async () => {
    if (!newUser.username || !newUser.email) {
      message.error('请填写完整信息');
      return;
    }

    try {
      await apiRequest('settings/mail-users', {
        method: 'POST',
        body: JSON.stringify(newUser),
      });
      message.success('添加成功');
      setDialogVisible(false);
      setNewUser({ username: '', email: '' });
      fetchMailUsers();
    } catch (err: any) {
      message.error(err.message || '添加失败');
    }
  };

  const handleDeleteMailUser = async (id: number) => {
    try {
      await apiRequest(`settings/mail-users/${id}`, {
        method: 'DELETE',
      });
      message.success('删除成功');
      fetchMailUsers();
    } catch (err: any) {
      message.error(err.message || '删除失败');
    }
  };

  const columns: ColumnsType<Setting> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '键',
      dataIndex: 'key',
      key: 'key',
      width: 200,
    },
    {
      title: '值',
      dataIndex: 'value',
      key: 'value',
      width: 300,
      render: (value: string) => (
        <div style={{ wordBreak: 'break-all' }}>
          {value}
        </div>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updated',
      key: 'updated',
      width: 180,
      render: (updated: string) => new Date(updated).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: Setting) => (
        <Button
          type="primary"
          size="small"
          icon={<EditOutlined />}
          onClick={() => {
            Modal.confirm({
              title: '编辑设置',
              content: (
                <div>
                  <div style={{ marginBottom: '16px' }}>
                    <strong>键:</strong> {record.key}
                  </div>
                  <Input.TextArea
                    defaultValue={record.value}
                    rows={4}
                    onChange={(e) => {
                      if (e.target.value !== record.value) {
                        handleUpdateSetting(record.key, e.target.value);
                      }
                    }}
                  />
                </div>
              ),
              onOk: () => {},
              okText: '关闭',
              cancelText: '取消',
            });
          }}
        >
          编辑
        </Button>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'notification',
      label: '通知配置',
      icon: <MailOutlined />,
    },
    {
      key: 'general',
      label: '基本设置',
    },
  ];

  return (
    <>
      <Card style={{ marginBottom: '16px' }}>
        <Space style={{ marginBottom: '16px' }}>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
            刷新
          </Button>
        </Space>
        
        <Tabs
          activeKey={activeTab}
          items={tabItems}
          onChange={(key) => setActiveTab(key as string)}
        />
      </Card>

      {activeTab === 'notification' && (
        <>
          <Card title="邮件服务器配置" style={{ marginBottom: '16px' }}>
            <Form layout="vertical" size="small">
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label="SMTP服务器">
                    <Input
                      value={emailConfig.host}
                      onChange={(e) => setEmailConfig({ ...emailConfig, host: e.target.value })}
                      placeholder="请输入邮件服务器地址"
                    />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item label="端口">
                    <Input
                      type="number"
                      value={emailConfig.port}
                      onChange={(e) => setEmailConfig({ ...emailConfig, port: Number(e.target.value) })}
                      placeholder="请输入端口"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="用户名">
                    <Input
                      value={emailConfig.user}
                      onChange={(e) => setEmailConfig({ ...emailConfig, user: e.target.value })}
                      placeholder="请输入用户名"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="密码">
                    <Input.Password
                      value={emailConfig.password}
                      onChange={(e) => setEmailConfig({ ...emailConfig, password: e.target.value })}
                      placeholder="请输入密码"
                    />
                  </Form.Item>
                </Col>
              </Row>
              
              <Form.Item label="通知模板">
                <Input.TextArea
                  rows={4}
                  value={emailConfig.template}
                  onChange={(e) => setEmailConfig({ ...emailConfig, template: e.target.value })}
                  placeholder="通知模板支持HTML"
                />
              </Form.Item>
              
              <Form.Item style={{ marginBottom: 0 }}>
                <Space>
                  <Button type="primary" onClick={handleSaveEmailConfig}>
                    保存
                  </Button>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setDialogVisible(true)}>
                    新增用户
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>

          <Card title="通知用户">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {mailUsers.map((user) => (
                <Tag
                  key={user.id}
                  closable
                  onClose={() => handleDeleteMailUser(user.id)}
                  style={{ fontSize: '14px', padding: '6px 12px' }}
                >
                  {user.username} - {user.email}
                </Tag>
              ))}
              {mailUsers.length === 0 && (
                <div style={{ color: '#999', padding: '20px 0' }}>
                  暂无通知用户
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {activeTab === 'general' && (
        <Card>
          <Table
            columns={columns}
            dataSource={settings}
            rowKey="id"
            loading={loading}
            bordered
            size="small"
          />
        </Card>
      )}

      <Modal
        title="新增通知用户"
        open={dialogVisible}
        onCancel={() => setDialogVisible(false)}
        onOk={handleAddMailUser}
        okText="确定"
        cancelText="取消"
      >
        <Form layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="用户名">
                <Input
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="请输入用户名"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="邮箱地址">
                <Input
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="请输入邮箱地址"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
};

export default SettingList;