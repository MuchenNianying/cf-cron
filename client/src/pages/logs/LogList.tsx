import { useState, useEffect } from 'react';
import { Table, Button, Form, Input, message, Space, Card, Select } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { apiRequest } from '../../config/api';
import type { ColumnsType } from 'antd/es/table';
import Modal from 'antd/es/modal/Modal';

interface TaskLog {
  id: number;
  task_id: number;
  task_name: string;
  status: number;
  output: string;
  duration: number;
  retry_times: number;
  spec: string;
  command: string;
  created_at: string;
}

const LogList = () => {
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTask, setSearchTask] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState<TaskLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`task-logs?task_id=${searchTask}&status=${searchStatus}&page=${page}&page_size=${pageSize}`);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      message.error(err.message || '获取日志失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, pageSize, searchTask, searchStatus]);

  const handleRefresh = () => {
    fetchLogs();
    message.success('刷新成功');
  };

  const handleShowOutput = (log: TaskLog) => {
    setSelectedLog(log);
    setDialogVisible(true);
  };

  const columns: ColumnsType<TaskLog> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '任务ID',
      dataIndex: 'task_id',
      key: 'task_id',
      width: 80,
    },
    {
      title: '任务名称',
      dataIndex: 'task_name',
      key: 'task_name',
      width: 180,
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
          {status === 1 ? '成功' : '失败'}
        </span>
      ),
    },
    {
      title: '执行时间',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (duration: number) => `${duration}ms`,
    },
    {
      title: '开始时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (created_at: string) => new Date(created_at).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: TaskLog) => (
        <Button
          type="primary"
          size="small"
          onClick={() => handleShowOutput(record)}
        >
          查看
        </Button>
      ),
    },
  ];

  const handleSearch = () => {
    setPage(1);
    fetchLogs();
  };

  return (
    <Card>
      <Form layout="inline" style={{ marginBottom: '16px' }}>
        <Form.Item label="任务名称">
          <Input
            placeholder="请输入任务名称"
            value={searchTask}
            onChange={(e) => setSearchTask(e.target.value)}
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
          />
        </Form.Item>
        <Form.Item label="状态">
          <Select
            placeholder="请选择状态"
            value={searchStatus}
            onChange={setSearchStatus}
            style={{ width: 120 }}
            allowClear
          >
            <Select.Option value="1">成功</Select.Option>
            <Select.Option value="0">失败</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" onClick={handleSearch}>
              搜索
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
              刷新
            </Button>
          </Space>
        </Form.Item>
      </Form>

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
          onChange: (newPage) => setPage(newPage),
          onShowSizeChange: () => setPage(1),
        }}
        bordered
        expandable={{
          expandedRowRender: (record: TaskLog) => (
            <div style={{ padding: '16px', backgroundColor: '#f5f5f5' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>重试次数:</strong> {record.retry_times}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>cron表达式:</strong> {record.spec}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>命令:</strong> {record.command}
              </div>
            </div>
          ),
        }}
      />

      <Modal
        title="任务执行结果"
        open={dialogVisible}
        onCancel={() => setDialogVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDialogVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        <div>
          <div style={{ marginBottom: '16px' }}>
            <strong>任务名称:</strong> {selectedLog?.task_name}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <strong>执行时间:</strong> {selectedLog?.duration}ms
          </div>
          <div style={{ marginBottom: '16px' }}>
            <strong>开始时间:</strong> {selectedLog?.created_at ? new Date(selectedLog.created_at).toLocaleString('zh-CN') : ''}
          </div>
          <div>
            <strong>执行结果:</strong>
            <pre style={{ 
              marginTop: '8px', 
              padding: '16px', 
              backgroundColor: '#f5f5f5', 
              borderRadius: '4px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}>
              {selectedLog?.output}
            </pre>
          </div>
        </div>
      </Modal>
    </Card>
  );
};

export default LogList;