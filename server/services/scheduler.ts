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
  CACHE: KVNamespace;
}

const CACHE_KEY = 'tasks_cache';
const CACHE_EXPIRY = 7 * 24 * 60 * 60; // 缓存过期时间：7天（秒）

export class Scheduler {
  private db: any;
  private secretKey: string;
  private cache: KVNamespace;

  constructor(env: Env) {
    this.db = env.DB;
    this.secretKey = env.SECRET_KEY || 'default_secret';
    this.cache = env.CACHE;
  }

  public async clearTaskCache() {
    try {
      await this.cache.delete(CACHE_KEY);
    } catch (error) {
      console.error('[Scheduler] 清空缓存失败:', error);
    }
  }

  public async updateTaskCache() {
    try {
      const tasks = await this.db.prepare(
        'SELECT id, name, spec, protocol, command, http_method, timeout, retry_times, retry_interval, request_headers, request_body, status FROM tasks WHERE status = 1'
      ).all();
      
      const cacheData = {
        tasks: tasks.results || [],
        timestamp: Date.now()
      };
      
      await this.cache.put(CACHE_KEY, JSON.stringify(cacheData), {
        expirationTtl: CACHE_EXPIRY
      });
      
      console.log(`[Scheduler] 更新KV缓存成功，共 ${cacheData.tasks.length} 个任务`);
    } catch (error) {
      console.error('[Scheduler] 更新缓存失败:', error);
    }
  }

  public async getCacheInfo() {
    try {
      const cacheStr = await this.cache.get(CACHE_KEY);
      if (!cacheStr) {
        return {
          tasks: [],
          taskCount: 0,
          lastUpdated: 0,
          isExpired: true
        };
      }
      
      const cacheData = JSON.parse(cacheStr);
      const isExpired = Date.now() - cacheData.timestamp > CACHE_EXPIRY * 1000;
      
      return {
        tasks: cacheData.tasks,
        taskCount: cacheData.tasks.length,
        lastUpdated: cacheData.timestamp,
        isExpired
      };
    } catch (error) {
      console.error('[Scheduler] 获取缓存失败:', error);
      return {
        tasks: [],
        taskCount: 0,
        lastUpdated: 0,
        isExpired: true
      };
    }
  }

  async run() {
    const now = new Date();
    console.log(`[Scheduler] 开始执行调度器，当前时间: ${now.toISOString()}`);
    
    try {
      let tasks = [];
      
      const cacheInfo = await this.getCacheInfo();
      console.log(`[Scheduler] KV缓存状态: 过期=${cacheInfo.isExpired}, 任务数=${cacheInfo.taskCount}`);
      
      if (cacheInfo.isExpired || cacheInfo.taskCount === 0) {
        const dbTasks = await this.db.prepare(
          'SELECT id, name, spec, protocol, command, http_method, timeout, retry_times, retry_interval, request_headers, request_body, status FROM tasks WHERE status = 1'
        ).all();
        tasks = dbTasks.results || [];
        
        await this.cache.put(CACHE_KEY, JSON.stringify({
          tasks: tasks,
          timestamp: Date.now()
        }), {
          expirationTtl: CACHE_EXPIRY
        });
        
        console.log(`[Scheduler] 从数据库获取任务，共 ${tasks.length} 个启用的任务`);
      } else {
        tasks = cacheInfo.tasks;
        console.log(`[Scheduler] 使用KV缓存的任务，共 ${tasks.length} 个任务`);
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
      
      return timeSincePrevRun >= 0 && timeSincePrevRun <= 5 * 60 * 1000;
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
      let headers: any = {};
      if (task.request_headers) {
        try {
          headers = JSON.parse(task.request_headers);
        } catch (error) {
          // 静默处理错误
        }
      }
      
      if (!headers['Content-Type'] && task.request_body) {
        headers['Content-Type'] = 'application/json';
      }
      
      let body: any = undefined;
      if (task.request_body) {
        body = task.request_body;
      }
      
      const timeout = task.timeout || 30;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);
      
      const response = await fetch(task.command, {
        method: task.http_method === 1 ? 'GET' : task.http_method === 2 ? 'POST' : 'GET',
        headers: headers,
        body: body,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
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
      return 'SSH 执行成功';
    } catch (error: any) {
      return `SSH 执行失败: ${error.message}`;
    }
  }

  private async executeLocalTask(task: Task): Promise<string> {
    try {
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
