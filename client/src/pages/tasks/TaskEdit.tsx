import { useState, useEffect } from 'react';
import { Form, Input, Select, Button, message, Card } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { apiRequest } from '../../config/api';

const TaskEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      
      if (!userData.is_admin) {
        message.error('您没有权限访问此页面');
        navigate('/tasks');
      }
    } else {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    if (isEdit) {
      fetchTask();
    }
  }, [isEdit, id]);

  const fetchTask = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`tasks/${id}`);
      form.setFieldsValue(data.task);
    } catch (err: any) {
      message.error(err.message || '获取任务失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const url = isEdit ? `tasks/${id}` : 'tasks';
      const method = isEdit ? 'PUT' : 'POST';

      await apiRequest(url, {
        method,
        body: JSON.stringify(values),
      });

      message.success(isEdit ? '更新成功' : '创建成功');
      navigate('/tasks');
    } catch (err: any) {
      message.error(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title={isEdit ? "编辑任务" : "创建任务"}>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          method: 'GET',
          status: 1,
          headers: '{}',
          body: '{}',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <Form.Item
            name="name"
            label="任务名称"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="请输入任务名称" />
          </Form.Item>
          <Form.Item
            name="tag"
            label="标签"
          >
            <Input placeholder="请输入标签" />
          </Form.Item>
          <Form.Item
            name="spec"
            label="Cron表达式"
            rules={[{ required: true, message: '请输入Cron表达式' }]}
            help="6位格式：秒 分 时 日 月 星期，例如：0 * * * * *（每分钟执行）"
          >
            <Input placeholder="* * * * * *" />
          </Form.Item>
          <Form.Item
            name="remark"
            label="备注"
          >
            <Input placeholder="请输入备注" />
          </Form.Item>
        </div>

        <Form.Item
          name="url"
          label="请求URL"
          rules={[{ required: true, message: '请输入请求URL' }]}
        >
          <Input placeholder="请输入请求URL" style={{ width: '100%' }} />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <Form.Item
            name="method"
            label="请求方法"
          >
            <Select placeholder="请选择请求方法">
              <Select.Option value="GET">GET</Select.Option>
              <Select.Option value="POST">POST</Select.Option>
              <Select.Option value="PUT">PUT</Select.Option>
              <Select.Option value="DELETE">DELETE</Select.Option>
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
        </div>

        <Form.Item
          name="headers"
          label="请求头 (JSON格式)"
        >
          <Input.TextArea 
            rows={4} 
            placeholder='例如: {"Content-Type": "application/json"}' 
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>

        <Form.Item
          name="body"
          label="请求体 (JSON格式)"
        >
          <Input.TextArea 
            rows={4} 
            placeholder='例如: {"key": "value"}' 
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>

        <Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Button onClick={() => navigate('/tasks')}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              {isEdit ? '更新' : '创建'}
            </Button>
          </div>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default TaskEdit;