import { useState, useEffect } from 'react';
import { Table, Button, Form, Input, message, Space, Card, Modal, Select } from 'antd';
import { ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';
import { apiRequest } from '../../config/api';
import type { ColumnsType } from 'antd/es/table';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  status: number;
  created_at: string;
  updated_at: string;
}

const UserList = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchName, setSearchName] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [form] = Form.useForm();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`users?name=${searchName}&email=${searchEmail}&status=${searchStatus}&page=${page}&page_size=${pageSize}`);
      // 转换后端返回的字段为前端User接口定义的字段
      const usersData = (data.users || []).map((user: any) => ({
        id: user.id,
        username: user.name, // 后端返回name，前端使用username
        email: user.email,
        role: user.is_admin === 1 ? 'admin' : 'user', // 后端返回is_admin，前端使用role
        status: user.status,
        created_at: user.created,
        updated_at: user.updated,
      }));
      setUsers(usersData);
      setTotal(data.total || 0);
    } catch (err: any) {
      message.error(err.message || '获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, pageSize, searchName, searchEmail, searchStatus]);

  const handleRefresh = () => {
    fetchUsers();
    message.success('刷新成功');
  };

  const handleSearch = () => {
    setPage(1);
    fetchUsers();
  };

  const handleReset = () => {
    setSearchName('');
    setSearchEmail('');
    setSearchStatus('');
    setPage(1);
    fetchUsers();
  };

  const handleCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    // 转换后端返回的字段为前端表单字段
    const formValues = {
      username: user.username, // 前端使用username
      email: user.email, // 保持不变
      role: user.role, // 前端使用role
      status: user.status, // 保持不变
    };
    form.setFieldsValue(formValues);
    setIsModalVisible(true);
  };

  const handleView = (user: any) => {
    setSelectedUser(user);
    setViewModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '确认',
      content: '确定要删除此用户吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await apiRequest(`users/${id}`, {
            method: 'DELETE',
          });
          message.success('删除成功');
          fetchUsers();
        } catch (err: any) {
          message.error(err.message || '删除失败');
        }
      },
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const url = editingUser ? `users/${editingUser.id}` : 'users';
      const method = editingUser ? 'PUT' : 'POST';

      // 转换前端表单字段为后端 API 期望的字段
      const userData = {
        name: values.username, // 前端的 username 字段对应后端的 name 字段
        password: values.password,
        email: values.email,
        is_admin: values.role === 'admin' ? 1 : 0, // 前端的 role 字段对应后端的 is_admin 字段
        status: values.status,
      };

      // 对于编辑操作，只有当密码被修改时才包含密码字段
      const body = editingUser 
        ? { ...userData, password: values.password ? values.password : undefined }
        : userData;

      await apiRequest(url, {
        method,
        body: JSON.stringify(body),
      });

      message.success(editingUser ? '更新成功' : '创建成功');
      setIsModalVisible(false);
      fetchUsers();
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  const columns: ColumnsType<User> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
      width: 120,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 180,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: number) => (
        <span style={{ 
          padding: '2px 8px', 
          borderRadius: '4px', 
          fontSize: '12px',
          backgroundColor: status === 1 ? '#f6ffed' : '#fff2f0',
          color: status === 1 ? '#52c41a' : '#ff4d4f'
        }}>
          {status === 1 ? '启用' : '禁用'}
        </span>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (created_at: string) => new Date(created_at).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: User) => (
        <Space size="small">
          <Button
            type="default"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
          <Button
            type="default"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {record.username !== 'admin' && record.name !== 'admin' && (
            <Button
              type="default"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id)}
            >
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card style={{ marginBottom: '16px' }}>
        <Form layout="inline" style={{ flexWrap: 'wrap', alignItems: 'flex-end', width: '100%' }}>
          <Form.Item label="用户名" style={{ marginRight: '8px', marginBottom: '8px' }}>
            <Input
              placeholder="请输入用户名"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
            />
          </Form.Item>
          <Form.Item label="邮箱" style={{ marginRight: '8px', marginBottom: '8px' }}>
            <Input
              placeholder="请输入邮箱"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
            />
          </Form.Item>
          <Form.Item label="状态" style={{ marginRight: '8px', marginBottom: '8px' }}>
            <Select
              placeholder="请选择状态"
              value={searchStatus}
              onChange={(value) => setSearchStatus(value)}
              style={{ width: 120 }}
              allowClear
            >
              <Select.Option value="1">启用</Select.Option>
              <Select.Option value="0">禁用</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item style={{ marginBottom: '8px' }}>
            <Space>
              <Button type="primary" onClick={handleSearch}>
                搜索
              </Button>
              <Button onClick={handleReset}>
                重置
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreate}
              >
                新增用户
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card style={{ height: 'calc(100vh - 280px)', overflow: 'auto' }}>
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (newPage) => setPage(newPage),
            onShowSizeChange: (_, size) => {
              setPageSize(size);
              setPage(1);
            },
            locale: {
              items_per_page: '条/页',
              jump_to: '跳至',
              page: '页',
              prev_page: '上一页',
              next_page: '下一页',
            },
          }}
          bordered
        />
      </Card>

      <Modal
        title={editingUser ? "编辑用户" : "创建用户"}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleSubmit}>
            {editingUser ? "更新" : "创建"}
          </Button>,
        ]}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            status: 1,
            role: 'user',
          }}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={!editingUser ? [{ required: true, message: '请输入密码' }] : []}
          >
            <Input.Password placeholder={editingUser ? "不修改请留空" : "请输入密码"} />
          </Form.Item>

          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ required: true, message: '请输入邮箱' }]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>

          <Form.Item
            name="role"
            label="角色"
          >
            <Select 
              placeholder="请选择角色"
              disabled={editingUser?.username === 'admin' || editingUser?.name === 'admin'}
            >
              <Select.Option value="admin">管理员</Select.Option>
              <Select.Option value="user">普通用户</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="status"
            label="状态"
          >
            <Select 
              placeholder="请选择状态"
              disabled={editingUser?.username === 'admin' || editingUser?.name === 'admin'}
            >
              <Select.Option value={1}>启用</Select.Option>
              <Select.Option value={0}>禁用</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看用户信息对话框 */}
      <Modal
        title="查看用户信息"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={[
          <Button key="ok" type="primary" onClick={() => setViewModalVisible(false)}>
            确定
          </Button>,
        ]}
        width={500}
      >
        {selectedUser && (
          <div style={{ lineHeight: '2.5' }}>
            <p><strong>ID：</strong>{selectedUser.id}</p>
            <p><strong>用户名：</strong>{selectedUser.name || selectedUser.username}</p>
            <p><strong>邮箱：</strong>{selectedUser.email}</p>
            <p><strong>角色：</strong>{selectedUser.is_admin === 1 ? '管理员' : '普通用户'}</p>
            <p><strong>状态：</strong>{selectedUser.status === 1 ? '启用' : '禁用'}</p>
            <p><strong>创建时间：</strong>{selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleString('zh-CN') : '-'}</p>
            <p><strong>更新时间：</strong>{selectedUser.updated_at ? new Date(selectedUser.updated_at).toLocaleString('zh-CN') : '-'}</p>
          </div>
        )}
      </Modal>
    </>
  );
};

export default UserList;