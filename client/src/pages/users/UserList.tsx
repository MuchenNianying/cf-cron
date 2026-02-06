import { useState, useEffect } from 'react';
import { Table, Button, Form, Input, message, Space, Card, Modal, Select } from 'antd';
import { ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { apiRequest } from '../../config/api';
import type { ColumnsType } from 'antd/es/table';

interface User {
  id: number;
  username: string;
  nickname: string;
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
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [form] = Form.useForm();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`users?page=${page}&page_size=${pageSize}`);
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      message.error(err.message || '获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, pageSize]);

  const handleRefresh = () => {
    fetchUsers();
    message.success('刷新成功');
  };

  const handleCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue(user);
    setIsModalVisible(true);
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

      // 对于编辑操作，只有当密码被修改时才包含密码字段
      const body = editingUser 
        ? { ...values, password: values.password ? values.password : undefined }
        : values;

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
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="default"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Space style={{ marginBottom: '16px' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新增用户
        </Button>
        <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
          刷新
        </Button>
      </Space>

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
          onChange: (newPage) => setPage(newPage),
          onShowSizeChange: () => setPage(1),
        }}
        bordered
      />

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
            name="nickname"
            label="昵称"
            rules={[{ required: true, message: '请输入昵称' }]}
          >
            <Input placeholder="请输入昵称" />
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
            <Select placeholder="请选择角色">
              <Select.Option value="admin">管理员</Select.Option>
              <Select.Option value="user">普通用户</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="status"
            label="状态"
          >
            <Select placeholder="请选择状态">
              <Select.Option value={1}>启用</Select.Option>
              <Select.Option value={0}>禁用</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default UserList;