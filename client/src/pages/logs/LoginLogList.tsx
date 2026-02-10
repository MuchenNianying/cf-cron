import { useState, useEffect } from 'react';
import { Table, Card, Button, Space } from 'antd';
import { ReloadOutlined, UserOutlined, GlobalOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { apiRequest } from '../../config/api';
import type { ColumnsType } from 'antd/es/table';

interface LoginLog {
  id: number;
  username: string;
  ip: string;
  login_time: string;
}

const LoginLogList = () => {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const fetchLoginLogs = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`logs/login-logs?page=${page}&page_size=${pageSize}`);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('获取登录日志失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoginLogs();
  }, [page, pageSize]);

  const handleRefresh = () => {
    fetchLoginLogs();
  };

  const columns: ColumnsType<LoginLog> = [
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
      width: 150,
      render: (username: string) => (
        <Space size="small">
          <UserOutlined />
          <span>{username}</span>
        </Space>
      ),
    },
    {
      title: '登录IP',
      dataIndex: 'ip',
      key: 'ip',
      width: 200,
      render: (ip: string) => (
        <Space size="small">
          <GlobalOutlined />
          <span>{ip}</span>
        </Space>
      ),
    },
    {
      title: '登录时间',
      dataIndex: 'login_time',
      key: 'login_time',
      width: 200,
      render: (login_time: string) => (
        <Space size="small">
          <ClockCircleOutlined />
          <span>{new Date(login_time).toLocaleString('zh-CN')}</span>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>登录日志</h2>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
            刷新
          </Button>
        </div>
      </Card>

      <Card style={{ height: 'calc(100vh - 280px)', overflow: 'auto' }}>
        <Table
          columns={columns}
          dataSource={logs}
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
    </>
  );
};

export default LoginLogList;