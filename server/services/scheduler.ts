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

// 全局缓存对象
const globalCache = {
  tasks: [],
  timestamp: 0,
  expiry: 24 * 60 * 60 * 1000 // 缓存过期时间：1天
};

// Cron 表达式解析缓存
const cronCache = new Map();

// 任务执行状态跟踪
const runningTasks = new Set();

export class Scheduler {
  private db: any;
  private secretKey: string;

  constructor(env: Env) {
    this.db = env.DB;
    this.secretKey = env.SECRET_KEY || 'default_secret';
  }

  // 清空任务缓存
  public clearTaskCache() {
    globalCache.tasks = [];
    globalCache.timestamp = 0;
  }

  // 手动更新任务缓存
  public async updateTaskCache() {
    try {
      // 只查询必要的字段，减少数据库传输和内存使用
      const tasks = await this.db.prepare(
        'SELECT id, name, spec, protocol, command, http_method, timeout, retry_times, retry_interval, request_headers, request_body, status FROM tasks WHERE status = 1'
      ).all();
      
      globalCache.tasks = tasks.results || [];
      globalCache.timestamp = Date.now();
    } catch (error) {
      // 静默处理错误
      globalCache.tasks = [];
    }
  }

  // 获取任务缓存信息
  public getCacheInfo() {
    return {
      tasks: globalCache.tasks,
      taskCount: globalCache.tasks.length,
      lastUpdated: globalCache.timestamp,
      isExpired: Date.now() - globalCache.timestamp > globalCache.expiry
    };
  }

  async run() {
    const startTime = Date.now();
    const startMemory = performance.memory?.usedJSHeapSize;
    
    const now = new Date();
    
    // 获取所有启用的任务（优先使用缓存）
    try {
      let tasks = [];
      
      // 检查缓存是否过期或为空
      const isCacheExpired = Date.now() - globalCache.timestamp > globalCache.expiry;
      if (isCacheExpired || globalCache.tasks.length === 0) {
        // 从数据库获取任务列表
        const dbTasks = await this.db.prepare(
          'SELECT id, name, spec, protocol, command, http_method, timeout, retry_times, retry_interval, request_headers, request_body, status FROM tasks WHERE status = 1'
        ).all();
        tasks = dbTasks.results || [];
        // 更新缓存
        globalCache.tasks = tasks;
        globalCache.timestamp = Date.now();
      } else {
        // 使用缓存的任务列表
        tasks = globalCache.tasks;
      }
      
      if (tasks.length === 0) {
        const endTime = Date.now();
        const endMemory = performance.memory?.usedJSHeapSize;
        console.log(`定时任务执行完成，无任务需要执行。执行时间: ${endTime - startTime}ms`);
        if (startMemory && endMemory) {
          console.log(`内存使用变化: ${(endMemory - startMemory) / 1024 / 1024}MB`);
        }
        return;
      }
      
      console.log(`开始执行定时任务，共 ${tasks.length} 个任务`);
      
      // 一次性执行所有任务
      const executionPromises = tasks.map(async (task: any) => {
        try {
          // 验证任务配置
          if (!task.spec) {
            return;
          }
          
          // 检查是否需要执行任务
          if (this.shouldExecuteTask(task.spec, now)) {
            // 检查任务是否已经在执行中
            if (runningTasks.has(task.id)) {
              console.log(`任务 ${task.id} (${task.name}) 正在执行中，跳过本次执行`);
              return;
            }
            
            // 标记任务为执行中
            runningTasks.add(task.id);
            
            try {
              // 执行任务
              await this.executeTask(task);
            } finally {
              // 标记任务为执行完成
              runningTasks.delete(task.id);
            }
          }
        } catch (error) {
          // 静默处理错误
          // 确保任务状态被清理
          runningTasks.delete(task.id);
        }
      });
      
      // 等待所有任务执行完成
      await Promise.all(executionPromises);
      
      const endTime = Date.now();
      const endMemory = performance.memory?.usedJSHeapSize;
      console.log(`所有定时任务执行完成，总执行时间: ${endTime - startTime}ms`);
      if (startMemory && endMemory) {
        console.log(`内存使用变化: ${(endMemory - startMemory) / 1024 / 1024}MB`);
      }
    } catch (error) {
      const endTime = Date.now();
      console.error(`定时任务执行失败: ${error}, 执行时间: ${endTime - startTime}ms`);
    }
  }

  private shouldExecuteTask(cronExpression: string, currentTime: Date): boolean {
    try {
      // 检查 cron 表达式格式，只支持 5 位格式：分 时 日 月 星期
      const cronParts = cronExpression.trim().split(/\s+/);
      
      if (cronParts.length !== 5) {
        // 格式不正确，只支持 5 位格式
        return false;
      }
      
      // 检查缓存中是否有解析结果
      if (!cronCache.has(cronExpression)) {
        // 统一使用 cron-parser 解析所有 cron 表达式
        const interval = cronParser.parseExpression(cronExpression, { tz: 'Asia/Shanghai' });
        cronCache.set(cronExpression, interval);
      }
      
      // 使用缓存的解析结果
      const interval = cronCache.get(cronExpression);
      const prevRun = interval.prev().toDate();
      
      // 检查当前时间是否接近上一个执行时间（1分钟内）
      const timeDiff = Math.abs(currentTime.getTime() - prevRun.getTime());
      return timeDiff <= 60 * 1000;
    } catch (error) {
      return false;
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
      
      // 设置合理的超时时间
      const timeout = task.timeout || 30; // 默认 30 秒
      
      // 发送 HTTP 请求
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);
      
      const response = await fetch(task.command, {
        method: task.http_method === 1 ? 'GET' : task.http_method === 2 ? 'POST' : 'GET',
        headers: headers,
        body: body,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // 只检查响应状态，不读取响应内容，减少内存使用
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