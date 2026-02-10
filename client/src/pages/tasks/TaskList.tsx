import { useState, useEffect } from 'react';
import { Table, Button, Form, Input, message, Space, Card, Modal } from 'antd';
import { ReloadOutlined, PlusOutlined, SearchOutlined, PlayCircleOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { apiRequest } from '../../config/api';

interface Task {
  id: number;
  name: string;
  spec: string;
  url: string;
  method: string;
  headers: string;
  body: string;
  tag: string;
  remark: string;
  status: number;
  created_at: string;
  updated_at: string;
  next_run_at: string;
}

const TaskList = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState('');
  const [searchTag, setSearchTag] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const isAdmin = user?.is_admin === 1;

  const fetchTasks = async () => {
    setLoading(true);
    try {
      console.log('开始获取任务列表...');
      const data = await apiRequest(`tasks?name=${searchName}&tag=${searchTag}&page=${page}&page_size=${pageSize}`);
      console.log('获取任务列表成功，返回数据:', data);
      
      // 转换后端返回的字段为前端Task接口定义的字段
      const tasksData = (data.tasks || []).map((task: any) => {
        console.log('处理任务:', task);
        // 直接使用后端返回的下次执行时间
        let next_run_at = task.next_run_at || 'N/A';
        console.log('下次执行时间:', next_run_at);
        
        return {
          id: task.id,
          name: task.name,
          spec: task.spec || '',
          url: task.command || '', // 后端的 command 字段对应前端的 url 字段
          method: task.http_method === 1 ? 'GET' : 'POST', // 转换数字为请求方法字符串，只支持 GET 和 POST
          headers: task.request_headers || '', // 后端的 request_headers 字段对应前端的 headers 字段
          body: task.request_body || '', // 后端的 request_body 字段对应前端的 body 字段
          tag: task.tag || '',
          remark: task.remark || '',
          status: task.status || 0,
          created_at: task.created || new Date().toISOString(),
          updated_at: task.updated || new Date().toISOString(),
          next_run_at: next_run_at,
        };
      });
      
      setTasks(tasksData);
      setTotal(data.total || 0);
    } catch (err: any) {
      message.error(err.message || '获取任务失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [page, pageSize, searchName, searchTag]);

  const handleRefresh = () => {
    fetchTasks();
    message.success('刷新成功');
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '确认',
      content: '确定要删除此任务吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await apiRequest(`tasks/${id}`, {
            method: 'DELETE',
          });
          message.success('删除成功');
          fetchTasks();
        } catch (err: any) {
          message.error(err.message || '删除失败');
        }
      },
    });
  };

  const handleManualRun = async (id: number) => {
    Modal.confirm({
      title: '确认',
      content: '确定要手动执行此任务吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await apiRequest(`tasks/${id}/run`, {
            method: 'POST',
          });
          message.success('任务已开始执行');
        } catch (err: any) {
          message.error(err.message || '执行失败');
        }
      },
    });
  };

  const handleToggleStatus = async (id: number, currentStatus: number) => {
    try {
      const endpoint = currentStatus === 1 ? 'disable' : 'enable';
      await apiRequest(`tasks/${id}/${endpoint}`, {
        method: 'POST',
      });
      message.success('状态更新成功');
      fetchTasks();
    } catch (err: any) {
      message.error(err.message || '状态更新失败');
    }
  };

  const columns: ColumnsType<Task> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
    },
    {
      title: 'Cron表达式',
      dataIndex: 'spec',
      key: 'spec',
      width: 180,
    },
    {
      title: '下次执行时间',
      dataIndex: 'next_run_at',
      key: 'next_run_at',
      width: 180,
      render: (next_run_at: string) => {
        if (next_run_at === 'N/A' || next_run_at === '无效表达式') {
          return next_run_at;
        }
        try {
          const date = new Date(next_run_at);
          // 使用本地时间（上海时间）显示
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
        } catch (error) {
          return '无效时间';
        }
      },
    },
    {
      title: '请求URL',
      dataIndex: 'url',
      key: 'url',
      width: 200,
      render: (url: string) => (
        <div style={{ wordBreak: 'break-all' }}>{url}</div>
      ),
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      width: 80,
      render: (method: string) => (
        <span style={{ 
          padding: '2px 8px', 
          borderRadius: '4px', 
          fontSize: '12px',
          backgroundColor: method === 'GET' ? '#e6f7ff' : '#f6ffed',
          color: method === 'GET' ? '#1890ff' : '#52c41a'
        }}>
          {method}
        </span>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tag',
      key: 'tag',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: number, record: Task) => (
        isAdmin ? (
          <Button
            type={status === 1 ? 'primary' : 'default'}
            size="small"
            onClick={() => handleToggleStatus(record.id, status)}
          >
            {status === 1 ? '运行中' : '已停止'}
          </Button>
        ) : (
          <span style={{ 
            padding: '2px 8px', 
            borderRadius: '4px', 
            fontSize: '12px',
            backgroundColor: status === 1 ? '#f6ffed' : '#fff2f0',
            color: status === 1 ? '#52c41a' : '#ff4d4f'
          }}>
            {status === 1 ? '运行中' : '已停止'}
          </span>
        )
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: Task) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleManualRun(record.id)}
          >
            执行
          </Button>
          {isAdmin && (
            <>
              <Button
                type="default"
                size="small"
                icon={<EditOutlined />}
                onClick={() => navigate(`/tasks/edit/${record.id}`)}
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
            </>
          )}
        </Space>
      ),
    },
  ];

  const handleSearch = () => {
    setPage(1);
    fetchTasks();
  };

  return (
    <Card>
      <Form layout="inline" style={{ marginBottom: '16px', flexWrap: 'wrap', alignItems: 'flex-end', width: '100%' }}>
        <Form.Item label="任务名称" style={{ marginRight: '8px', marginBottom: '8px' }}>
          <Input
            placeholder="请输入任务名称"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
          />
        </Form.Item>
        <Form.Item label="标签" style={{ marginRight: '8px', marginBottom: '8px' }}>
          <Input
            placeholder="请输入标签"
            value={searchTag}
            onChange={(e) => setSearchTag(e.target.value)}
            style={{ width: 150 }}
          />
        </Form.Item>
        <Form.Item style={{ marginBottom: '8px' }}>
          <Space>
            <Button type="primary" onClick={handleSearch}>
              搜索
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
              刷新
            </Button>
            {isAdmin && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/tasks/create')}>
                新增
              </Button>
            )}
          </Space>
        </Form.Item>
      </Form>

      <Table
        columns={columns}
        dataSource={tasks}
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
  );
};

export default TaskList;