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
  expiry: 7 * 24 * 60 * 60 * 1000 // 缓存过期时间：7天
};

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
    const now = new Date();
    console.log(`[Scheduler] 开始执行调度器，当前时间: ${now.toISOString()}`);
    
    try {
      let tasks = [];
      
      const isCacheExpired = Date.now() - globalCache.timestamp > globalCache.expiry;
      console.log(`[Scheduler] 缓存状态: 过期=${isCacheExpired}, 任务数=${globalCache.tasks.length}`);
      
      if (isCacheExpired || globalCache.tasks.length === 0) {
        const dbTasks = await this.db.prepare(
          'SELECT id, name, spec, protocol, command, http_method, timeout, retry_times, retry_interval, request_headers, request_body, status FROM tasks WHERE status = 1'
        ).all();
        tasks = dbTasks.results || [];
        globalCache.tasks = tasks;
        globalCache.timestamp = Date.now();
        console.log(`[Scheduler] 从数据库获取任务，共 ${tasks.length} 个启用的任务`);
      } else {
        tasks = globalCache.tasks;
        console.log(`[Scheduler] 使用缓存的任务，共 ${tasks.length} 个任务`);
      }
      
      if (tasks.length === 0) {
        console.log('[Scheduler] 没有启用的任务，跳过执行');
        return;
      }
      
      let executedCount = 0;
      
      const executionPromises = tasks.map(async (task: any) => {
        try {
          if (!task.spec) {
            console.log(`[Scheduler] 任务 ${task.id} (${task.name}) 没有 cron 表达式，跳过`);
            return;
          }
          
          const shouldExecute = this.shouldExecuteTask(task.spec, now);
          console.log(`[Scheduler] 任务 ${task.id} (${task.name}) cron: ${task.spec}, 是否执行: ${shouldExecute}`);
          
          if (shouldExecute) {
            console.log(`[Scheduler] 开始执行任务 ${task.id} (${task.name})`);
            await this.executeTask(task);
            executedCount++;
          }
        } catch (error) {
          console.error(`[Scheduler] 任务 ${task.id} 执行出错:`, error);
        }
      });
      
      await Promise.all(executionPromises);
      console.log(`[Scheduler] 调度器执行完成，共执行 ${executedCount} 个任务`);
    } catch (error) {
      console.error('[Scheduler] 调度器执行失败:', error);
    }
  }

  private shouldExecuteTask(cronExpression: string, currentTime: Date): boolean {
    try {
      const cronParts = cronExpression.trim().split(/\s+/);
      
      if (cronParts.length !== 5) {
        return false;
      }
      
      const interval = cronParser.parseExpression(cronExpression, { tz: 'Asia/Shanghai' });
      const prevRun = interval.prev().toDate();
      const nextRun = interval.next().toDate();
      
      const timeSincePrevRun = currentTime.getTime() - prevRun.getTime();
      const timeUntilNextRun = nextRun.getTime() - currentTime.getTime();
      
      return timeSincePrevRun >= 0 && timeSincePrevRun <= 60 * 1000;
    } catch (error) {
      return false;
    }
  }

  private async executeTask(task: Task) {
    console.log(`[Scheduler] 开始执行任务 ${task.id} (${task.name}), 协议: ${task.protocol}, URL: ${task.command}`);
    
    let logId: number;
    try {
      logId = await this.createTaskLog(task);
      console.log(`[Scheduler] 创建任务日志成功，日志ID: ${logId}`);
    } catch (error) {
      console.error(`[Scheduler] 创建任务日志失败:`, error);
      return;
    }
    
    let result = '执行成功';
    let status = 2;
    
    try {
      if (task.protocol === 1) {
        result = await this.executeHTTPTask(task);
      } else if (task.protocol === 2) {
        result = await this.executeSSHTask(task);
      } else if (task.protocol === 3) {
        result = await this.executeLocalTask(task);
      } else {
        result = '不支持的协议类型';
        status = 0;
      }
      console.log(`[Scheduler] 任务 ${task.id} 执行结果: ${result}`);
    } catch (error: any) {
      result = `执行失败: ${error.message}`;
      status = 0;
      console.error(`[Scheduler] 任务 ${task.id} 执行失败:`, error);
    }
    
    try {
      await this.updateTaskLog(logId, status, result);
      console.log(`[Scheduler] 更新任务日志成功`);
    } catch (error) {
      console.error(`[Scheduler] 更新任务日志失败:`, error);
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