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
  const [method, setMethod] = useState('GET');

  // 监听请求方法的变化
  const handleValuesChange = (changedValues: any) => {
    if (changedValues.method !== undefined) {
      setMethod(changedValues.method || 'GET');
    }
  };

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
      const task = data.task;
      
      // 转换后端返回的字段为前端表单字段
      const formValues = {
        name: task.name,
        tag: task.tag,
        spec: task.spec,
        remark: task.remark,
        url: task.command, // 后端的 command 字段对应前端的 url 字段
        protocol: task.protocol,
        method: task.http_method === 1 ? 'GET' : 'POST', // 转换数字为请求方法字符串，只支持 GET 和 POST
        headers: task.request_headers, // 后端的 request_headers 字段对应前端的 headers 字段
        body: task.request_body, // 后端的 request_body 字段对应前端的 body 字段
        status: task.status,
        dependency_task_id: task.dependency_task_id,
        dependency_status: task.dependency_status,
        timeout: task.timeout,
        multi: task.multi,
        retry_times: task.retry_times,
        retry_interval: task.retry_interval,
        notify_status: task.notify_status,
        notify_type: task.notify_type,
        notify_receiver_id: task.notify_receiver_id,
        notify_keyword: task.notify_keyword,
      };
      
      form.setFieldsValue(formValues);
      // 更新method状态
      setMethod(formValues.method);
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

      // 转换前端表单字段为后端 API 期望的字段
      const taskData = {
        name: values.name,
        tag: values.tag,
        spec: values.spec,
        remark: values.remark,
        command: values.url, // 前端的 url 字段对应后端的 command 字段
        protocol: values.protocol, // 协议类型
        http_method: values.method === 'GET' ? 1 : 2, // 转换请求方法为数字，只支持 GET 和 POST
        request_headers: values.headers, // 前端的 headers 字段对应后端的 request_headers 字段
        request_body: values.body, // 前端的 body 字段对应后端的 request_body 字段
        status: values.status,
        dependency_task_id: values.dependency_task_id, // 依赖任务ID
        dependency_status: values.dependency_status, // 依赖状态
        timeout: values.timeout, // 超时时间
        multi: values.multi, // 多实例支持
        retry_times: values.retry_times, // 重试次数
        retry_interval: values.retry_interval, // 重试间隔
        notify_status: values.notify_status, // 通知状态
        notify_type: values.notify_type, // 通知类型
        notify_receiver_id: values.notify_receiver_id, // 通知接收者ID
        notify_keyword: values.notify_keyword, // 通知关键字
      };

      await apiRequest(url, {
        method,
        body: JSON.stringify(taskData),
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
        onValuesChange={handleValuesChange}
        initialValues={{
          method: 'GET',
          status: 1,
          protocol: 1, // 默认 HTTP 协议
          dependency_task_id: '', // 默认无依赖
          dependency_status: 1, // 默认依赖状态
          timeout: 0, // 默认无超时
          multi: 1, // 默认支持多实例
          retry_times: 0, // 默认无重试
          retry_interval: 0, // 默认无重试间隔
          notify_status: 1, // 默认启用通知
          notify_type: 0, // 默认通知类型
          notify_receiver_id: '', // 默认无接收者
          notify_keyword: '', // 默认无关键字
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
            rules={[
              { required: true, message: '请输入Cron表达式' },
              {
                validator: (_, value) => {
                  if (!value) {
                    return Promise.resolve();
                  }
                  const parts = value.trim().split(/\s+/);
                  if (parts.length !== 5) {
                    return Promise.reject(new Error('Cron表达式必须为5位格式：分 时 日 月 星期'));
                  }
                  // 简单验证每个部分是否为有效的 cron 字段
                  const [minute, hour, day, month, weekday] = parts;
                  const validChars = /^[\d\*\/\-,]+$/;
                  if (!validChars.test(minute) || !validChars.test(hour) || !validChars.test(day) || !validChars.test(month) || !validChars.test(weekday)) {
                    return Promise.reject(new Error('Cron表达式包含无效字符'));
                  }
                  return Promise.resolve();
                }
              }
            ]}
            help="5位格式：分 时 日 月 星期，例如：0 * * * *（每小时执行）"
          >
            <Input placeholder="* * * * *" />
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
          <Form.Item
            name="protocol"
            label="协议类型"
          >
            <Select placeholder="请选择协议类型">
              <Select.Option value={1}>HTTP</Select.Option>
              <Select.Option value={2}>HTTPS</Select.Option>
            </Select>
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <Form.Item
            name="dependency_task_id"
            label="依赖任务ID"
          >
            <Input placeholder="请输入依赖任务ID" />
          </Form.Item>
          <Form.Item
            name="dependency_status"
            label="依赖状态"
          >
            <Select placeholder="请选择依赖状态">
              <Select.Option value={1}>成功</Select.Option>
              <Select.Option value={0}>失败</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="timeout"
            label="超时时间(秒)"
          >
            <Input type="number" placeholder="请输入超时时间" />
          </Form.Item>
          <Form.Item
            name="multi"
            label="多实例支持"
          >
            <Select placeholder="请选择多实例支持">
              <Select.Option value={1}>支持</Select.Option>
              <Select.Option value={0}>不支持</Select.Option>
            </Select>
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <Form.Item
            name="retry_times"
            label="重试次数"
          >
            <Input type="number" placeholder="请输入重试次数" />
          </Form.Item>
          <Form.Item
            name="retry_interval"
            label="重试间隔(秒)"
          >
            <Input type="number" placeholder="请输入重试间隔" />
          </Form.Item>
          <Form.Item
            name="notify_status"
            label="通知状态"
          >
            <Select placeholder="请选择通知状态">
              <Select.Option value={1}>启用</Select.Option>
              <Select.Option value={0}>禁用</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="notify_type"
            label="通知类型"
          >
            <Select placeholder="请选择通知类型">
              <Select.Option value={0}>邮件</Select.Option>
              <Select.Option value={1}>短信</Select.Option>
              <Select.Option value={2}>Webhook</Select.Option>
            </Select>
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <Form.Item
            name="notify_receiver_id"
            label="通知接收者ID"
          >
            <Input placeholder="请输入通知接收者ID" />
          </Form.Item>
          <Form.Item
            name="notify_keyword"
            label="通知关键字"
          >
            <Input placeholder="请输入通知关键字" />
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

        {method === 'POST' && (
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
        )}

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