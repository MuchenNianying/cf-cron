import { useState, useEffect } from 'react';
import { Table, Button, Form, Input, message, Space, Card, Select } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { apiRequest } from '../../config/api';
import type { ColumnsType } from 'antd/es/table';
import Modal from 'antd/es/modal/Modal';

interface TaskLog {
  id: number;
  task_id: number;
  name: string;
  status: number;
  result: string;
  retry_times: number;
  spec: string;
  command: string;
  start_time: string;
  end_time: string;
  protocol: number;
  hostname: string;
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
      dataIndex: 'name',
      key: 'name',
      width: 180,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: number) => {
        let statusText = '';
        let bgColor = '';
        let textColor = '';
        
        switch (status) {
          case 0:
            statusText = '失败';
            bgColor = '#fff2f0';
            textColor = '#ff4d4f';
            break;
          case 1:
            statusText = '执行中';
            bgColor = '#e6f7ff';
            textColor = '#1890ff';
            break;
          case 2:
            statusText = '成功';
            bgColor = '#f6ffed';
            textColor = '#52c41a';
            break;
          default:
            statusText = '未知';
            bgColor = '#f5f5f5';
            textColor = '#333';
        }
        
        return (
          <span style={{ 
            padding: '2px 8px', 
            borderRadius: '4px', 
            fontSize: '12px',
            backgroundColor: bgColor,
            color: textColor
          }}>
            {statusText}
          </span>
        );
      },
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 180,
      render: (start_time: string) => new Date(start_time).toLocaleString('zh-CN'),
    },
    {
      title: '结束时间',
      dataIndex: 'end_time',
      key: 'end_time',
      width: 180,
      render: (end_time: string) => end_time ? new Date(end_time).toLocaleString('zh-CN') : '未结束',
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
              <div style={{ marginBottom: '8px' }}>
                <strong>协议:</strong> {record.protocol === 1 ? 'HTTP' : '其他'}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>主机名:</strong> {record.hostname}
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
            <strong>任务名称:</strong> {selectedLog?.name}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <strong>开始时间:</strong> {selectedLog?.start_time ? new Date(selectedLog.start_time).toLocaleString('zh-CN') : ''}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <strong>结束时间:</strong> {selectedLog?.end_time ? new Date(selectedLog.end_time).toLocaleString('zh-CN') : '未结束'}
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
              {selectedLog?.result}
            </pre>
          </div>
        </div>
      </Modal>
    </Card>
  );
};

export default LogList;