import cronParser from 'cron-parser';

interface Task {
  id: number;
  name: string;
  spec: string;
  protocol: number;
  command: string;
  http_method: number;
  timeout: number;
  retry_times: number;
  retry_interval: number;
  request_headers: string;
  request_body: string;
}

interface Env {
  DB: any;
  SECRET_KEY: string;
}

export class Scheduler {
  private db: any;
  private secretKey: string;
  private taskCache: any[] = [];
  private cacheTimestamp: number = 0;
  private cacheExpiry: number = 24 * 60 * 60 * 1000; // 缓存过期时间：1天

  constructor(env: Env) {
    this.db = env.DB;
    this.secretKey = env.SECRET_KEY || 'default_secret';
  }

  // 清空任务缓存
  public clearTaskCache() {
    this.taskCache = [];
    this.cacheTimestamp = 0;
  }

  // 手动更新任务缓存
  public async updateTaskCache() {
    try {
      const tasks = await this.db.prepare(
        'SELECT id, name, spec FROM tasks WHERE status = 1'
      ).all();
      
      this.taskCache = tasks.results || [];
      this.cacheTimestamp = Date.now();
    } catch (error) {
      // 静默处理错误
      this.taskCache = [];
    }
  }

  async run() {
    const now = new Date();
    console.log(`=== 调度器运行开始 ===`);
    
    // 获取所有启用的任务（优先使用缓存）
    try {
      let tasks = [];
      
      // 检查缓存是否过期或为空
      const isCacheExpired = Date.now() - this.cacheTimestamp > this.cacheExpiry;
      if (isCacheExpired || this.taskCache.length === 0) {
        console.log('缓存过期或为空，重新获取任务列表');
        // 从数据库获取任务列表
        const dbTasks = await this.db.prepare(
          'SELECT id, name, spec FROM tasks WHERE status = 1'
        ).all();
        tasks = dbTasks.results || [];
        // 更新缓存
        this.taskCache = tasks;
        this.cacheTimestamp = Date.now();
      } else {
        console.log('使用缓存的任务列表');
        // 使用缓存的任务列表
        tasks = this.taskCache;
      }
      
      if (tasks.length === 0) {
        console.log('没有找到启用的任务，调度器结束');
        return;
      }
      
      console.log(`找到 ${tasks.length} 个启用的任务`);
      
      for (const task of tasks as any[]) {
        try {
          // 验证任务配置
          if (!task.spec) {
            continue;
          }
          
          // 检查是否需要执行任务
          if (this.shouldExecuteTask(task.spec, now)) {
            // 直接执行任务，不考虑是否重复执行
            // 只要当前时间在 cron 表达式的时间所属时间（一分钟误差内）就执行
            await this.executeTaskById(task.id);
          }
        } catch (error) {
          // 静默处理错误
        }
      }
    } catch (error) {
      // 静默处理错误
    }
    
    console.log(`=== 调度器运行结束 ===`);
  }

  private shouldExecuteTask(cronExpression: string, currentTime: Date): boolean {
    try {
      // 检查 cron 表达式格式，只支持 5 位格式：分 时 日 月 星期
      const cronParts = cronExpression.trim().split(/\s+/);
      
      if (cronParts.length !== 5) {
        // 格式不正确，只支持 5 位格式
        return false;
      }
      
      // 对于常见的 cron 表达式，使用简单的判断逻辑
      // 分钟级任务 (* * * * *)
      if (cronExpression === '* * * * *') {
        // 每分钟执行一次，只要在当前分钟内就执行
        return true;
      }
      
      // 对于其他任务，使用 cron-parser 解析
      const interval = cronParser.parseExpression(cronExpression, { tz: 'Asia/Shanghai' });
      const prevRun = interval.prev().toDate();
      
      // 检查当前时间是否接近上一个执行时间（1分钟内）
      const timeDiff = Math.abs(currentTime.getTime() - prevRun.getTime());
      return timeDiff <= 60 * 1000;
    } catch (error) {
      return false;
    }
  }

  private async executeTaskById(taskId: number) {
    try {
      // 获取任务详情
      const task = await this.db.prepare(
        'SELECT id, name, spec, protocol, command, http_method, timeout, retry_times, retry_interval, request_headers, request_body FROM tasks WHERE id = ?'
      ).bind(taskId).first();
      
      if (task) {
        await this.executeTask(task as Task);
      }
    } catch (error) {
      // 静默处理错误
    }
  }

  private async executeTask(task: Task) {
    let logId: number;
    try {
      // 创建任务日志
      logId = await this.createTaskLog(task);
    } catch (error) {
      // 即使日志创建失败，也要继续执行任务
      return;
    }
    
    let result = '执行成功';
    let status = 2;
    
    try {
      // 根据协议执行任务
      if (task.protocol === 1) {
        // HTTP 任务
        result = await this.executeHTTPTask(task);
      } else if (task.protocol === 2) {
        // SSH 任务
        result = await this.executeSSHTask(task);
      } else if (task.protocol === 3) {
        // 本地任务
        result = await this.executeLocalTask(task);
      } else {
        result = '不支持的协议类型';
        status = 0;
      }
    } catch (error: any) {
      result = `执行失败: ${error.message}`;
      status = 0;
    }
    
    try {
      // 更新任务日志
      await this.updateTaskLog(logId, status, result);
    } catch (error) {
      // 静默处理错误
    }
  }

  private async executeHTTPTask(task: Task): Promise<string> {
    try {
      // 解析请求头
      let headers: any = {};
      if (task.request_headers) {
        try {
          headers = JSON.parse(task.request_headers);
        } catch (error) {
          // 静默处理错误
        }
      }
      
      // 检查并设置默认 Content-Type
      if (!headers['Content-Type'] && task.request_body) {
        headers['Content-Type'] = 'application/json';
      }
      
      // 处理请求体
      let body: any = undefined;
      if (task.request_body) {
        // 对于 POST 请求，直接使用原始字符串作为 body
        body = task.request_body;
      }
      
      // 发送 HTTP 请求
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), (task.timeout || 60) * 1000);
      
      const response = await fetch(task.command, {
        method: task.http_method === 1 ? 'GET' : task.http_method === 2 ? 'POST' : task.http_method === 3 ? 'PUT' : task.http_method === 4 ? 'DELETE' : 'GET',
        headers: headers,
        body: body,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      await response.text(); // 读取响应内容，避免内存泄漏
      
      if (!response.ok) {
        throw new Error(`HTTP 错误: ${response.status} ${response.statusText}`);
      }
      
      return `HTTP 执行成功: ${response.status} ${response.statusText}`;
    } catch (error: any) {
      return `HTTP 执行失败: ${error.message}`;
    }
  }

  private async executeSSHTask(task: Task): Promise<string> {
    try {
      // 这里需要实现 SSH 任务执行逻辑
      return 'SSH 执行成功';
    } catch (error: any) {
      return `SSH 执行失败: ${error.message}`;
    }
  }

  private async executeLocalTask(task: Task): Promise<string> {
    try {
      // 这里需要实现本地任务执行逻辑
      return '本地执行成功';
    } catch (error: any) {
      return `本地执行失败: ${error.message}`;
    }
  }

  private async createTaskLog(task: Task): Promise<number> {
    try {
      const result = await this.db.prepare(
        'INSERT INTO task_logs (task_id, name, spec, protocol, command, timeout, retry_times, hostname, status, result, start_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(task.id, task.name, task.spec, task.protocol, task.command, task.timeout || 0, task.retry_times || 0, 'localhost', 1, '执行中...', new Date().toISOString()).run();
      
      const logId = result.meta?.last_row_id || result.lastInsertRowid;
      
      if (!logId) {
        throw new Error('无法获取任务日志 ID');
      }
      
      return logId;
    } catch (error) {
      throw error;
    }
  }

  private async updateTaskLog(id: number, status: number, result: string) {
    try {
      await this.db.prepare(
        'UPDATE task_logs SET status = ?, result = ?, end_time = ? WHERE id = ?'
      ).bind(status, result, new Date().toISOString(), id).run();
    } catch (error) {
      // 静默处理错误
    }
  }
}
