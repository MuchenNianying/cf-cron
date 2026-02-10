import { useState, useEffect } from 'react';
import { Table, Button, Form, Input, message, Space, Card, Select, Modal } from 'antd';
import { ReloadOutlined, SearchOutlined, DeleteOutlined } from '@ant-design/icons';
import { apiRequest } from '../../config/api';
import type { ColumnsType } from 'antd/es/table';

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
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState<TaskLog | null>(null);
  const [user, setUser] = useState<any>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`task-logs?name=${searchTask}&status=${searchStatus}&page=${page}&page_size=${pageSize}`);
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

  const handleClearLogs = async () => {
    if (selectedRowKeys.length > 0) {
      // 显示批量删除确认框
      Modal.confirm({
        title: '确认',
        content: `确定要删除选中的 ${selectedRowKeys.length} 条任务日志吗？`,
        okText: '确定',
        cancelText: '取消',
        onOk: async () => {
          try {
            await apiRequest('task-logs/batch', {
              method: 'DELETE',
              body: JSON.stringify({ ids: selectedRowKeys })
            });
            message.success('删除选中日志成功');
            setSelectedRowKeys([]);
            fetchLogs();
          } catch (err: any) {
            message.error(err.message || '删除选中日志失败');
          }
        },
      });
    } else {
      // 显示清空所有确认框
      Modal.confirm({
        title: '确认',
        content: '确定要清空所有任务日志吗？',
        okText: '确定',
        cancelText: '取消',
        onOk: async () => {
          try {
            await apiRequest('task-logs/clear', {
              method: 'DELETE'
            });
            message.success('清空所有日志成功');
            fetchLogs();
          } catch (err: any) {
            message.error(err.message || '清空所有日志失败');
          }
        },
      });
    }
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
    <>
      <Card style={{ marginBottom: '16px' }}>
        <Form layout="inline" style={{ flexWrap: 'wrap', alignItems: 'flex-end', width: '100%' }}>
          <Form.Item label="任务名称" style={{ marginRight: '8px', marginBottom: '8px' }}>
            <Input
              placeholder="请输入任务名称"
              value={searchTask}
              onChange={(e) => setSearchTask(e.target.value)}
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
            />
          </Form.Item>
          <Form.Item label="状态" style={{ marginRight: '8px', marginBottom: '8px' }}>
            <Select
              placeholder="请选择状态"
              value={searchStatus}
              onChange={setSearchStatus}
              style={{ width: 120 }}
              allowClear
            >
              <Select.Option value="2">成功</Select.Option>
              <Select.Option value="1">执行中</Select.Option>
              <Select.Option value="0">失败</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item style={{ marginBottom: '8px' }}>
            <Space>
              <Button type="primary" onClick={handleSearch}>
                搜索
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
                刷新
              </Button>
              {user?.is_admin === 1 && (
                <Button 
                  danger 
                  icon={<DeleteOutlined />}
                  onClick={handleClearLogs}
                >
                  清空日志
                </Button>
              )}
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card style={{ height: 'calc(100vh - 280px)', overflow: 'auto' }}>
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
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
      </Card>

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

    </>
  );
};

export default LogList;