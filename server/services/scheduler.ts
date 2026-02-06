import cronParser from 'cron-parser';
import { DB } from '@cloudflare/workers-types';

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
  DB: DB;
}

export class Scheduler {
  private db: DB;

  constructor(env: Env) {
    this.db = env.DB;
  }

  async run() {
    const now = new Date();
    console.log(`=== 调度器运行开始: ${now.toISOString()} ===`);
    
    // 获取所有启用的任务
    console.log('开始查询启用的任务...');
    const tasks = await this.db.prepare(
      'SELECT id, name, spec, protocol, command, http_method, timeout, retry_times, retry_interval, request_headers, request_body FROM tasks WHERE status = 1'
    ).all();
    
    console.log(`查询完成，找到 ${tasks.results?.length || 0} 个启用的任务`);
    
    if (!tasks.results || tasks.results.length === 0) {
      console.log('没有找到启用的任务，调度器结束');
      return;
    }
    
    for (const task of tasks.results as Task[]) {
      try {
        console.log(`\n处理任务: ${task.id} - ${task.name}`);
        console.log(`任务配置: cron=${task.spec}, protocol=${task.protocol}, command=${task.command}`);
        
        // 解析 cron 表达式
        const interval = cronParser.parseExpression(task.spec);
        
        // 检查任务是否应该在当前时间执行
        // 方法：检查当前时间是否是任务的下一个执行时间点
        // 获取上一个执行时间
        const prevRun = interval.prev().toDate();
        
        // 计算上一个执行时间的分钟数
        const prevRunMinute = prevRun.getMinutes();
        const currentMinute = now.getMinutes();
        
        // 对于分钟级别的任务，检查是否在当前分钟内
        // 对于其他级别的任务，检查是否到达了执行时间点
        
        // 获取任务的 cron 表达式的各个部分
        const cronParts = task.spec.split(' ');
        const minutePart = cronParts[0];
        
        console.log(`Cron 表达式分析: minute=${minutePart}`);
        console.log(`时间检查: 上次执行分钟 ${prevRunMinute}, 当前分钟 ${currentMinute}`);
        
        // 检查是否需要执行任务
        if (this.shouldExecuteTask(task.spec, now)) {
          // 检查是否已经执行过（避免重复执行）
          console.log('检查是否已经执行过...');
          
          // 对于分钟级任务，检查过去2分钟内是否执行过
          // 对于其他任务，检查过去1小时内是否执行过
          const checkTime = new Date(now.getTime() - (minutePart === '*' ? 2 : 60) * 60 * 1000);
          
          const lastLog = await this.db.prepare(
            'SELECT * FROM task_logs WHERE task_id = ? AND start_time >= ? ORDER BY id DESC LIMIT 1'
          ).bind(task.id, checkTime.toISOString()).first();
          
          if (!lastLog) {
            console.log('任务未执行过，开始执行...');
            // 执行任务
            await this.executeTask(task);
            console.log('任务执行完成');
          } else {
            console.log('任务已经执行过，跳过');
          }
        } else {
          console.log('任务不在执行时间窗口内，跳过');
        }
      } catch (error) {
        console.error(`处理任务 ${task.id} 时出错:`, error);
      }
    }
    
    console.log(`\n=== 调度器运行结束 ===`);
  }
  
  /**
   * 检查任务是否应该在当前时间执行
   * @param cronExpression cron 表达式
   * @param currentTime 当前时间
   * @returns 是否应该执行
   */
  private shouldExecuteTask(cronExpression: string, currentTime: Date): boolean {
    try {
      const interval = cronParser.parseExpression(cronExpression);
      const nextRun = interval.next().toDate();
      const prevRun = interval.prev().toDate();
      
      // 对于分钟级任务 (* * * * *)，检查当前时间是否在上一分钟内
      if (cronExpression === '* * * * *') {
        // 检查是否在上一分钟内
        const oneMinuteAgo = new Date(currentTime.getTime() - 60 * 1000);
        return prevRun >= oneMinuteAgo && prevRun <= currentTime;
      }
      
      // 对于其他任务，检查当前时间是否接近上一个执行时间
      // 允许有1分钟的误差
      const timeDiff = Math.abs(currentTime.getTime() - prevRun.getTime());
      return timeDiff <= 60 * 1000; // 1分钟内
    } catch (error) {
      console.error(`解析 cron 表达式失败: ${cronExpression}`, error);
      return false;
    }
  }

  private async executeTask(task: Task) {
    // 创建任务日志
    const logId = await this.createTaskLog(task);

    try {
      let result = '';
      let status = 2; // 成功

      if (task.protocol === 1) {
        // HTTP 任务
        result = await this.executeHTTPTask(task);
      } else {
        // 只支持 HTTP 任务
        throw new Error('只支持 HTTP 任务类型');
      }

      console.log(`任务 ${task.id} 执行成功，结果:`, result);
      // 更新任务日志
      await this.updateTaskLog(logId, status, result);
    } catch (error) {
      console.error(`任务 ${task.id} 执行失败:`, error);
      
      // 更新任务日志为失败
      const errorMsg = error?.message || '执行失败';
      console.log(`任务 ${task.id} 错误信息:`, errorMsg);
      await this.updateTaskLog(logId, 0, errorMsg);
    }
  }

  private async createTaskLog(task: Task): Promise<number> {
    console.log(`创建任务日志: task_id=${task.id}, name=${task.name}`);
    const result = await this.db.prepare(
      'INSERT INTO task_logs (task_id, name, spec, protocol, command, timeout, retry_times, hostname, status, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(task.id, task.name, task.spec, task.protocol, task.command, task.timeout, task.retry_times, 'localhost', 1, '执行中...').run();
    
    const logId = result.meta?.last_row_id || result.lastInsertRowid;
    console.log(`任务日志创建成功: logId=${logId}, result=`, result);
    
    if (!logId) {
      throw new Error('无法获取任务日志 ID');
    }
    
    return logId;
  }

  private async updateTaskLog(id: number, status: number, result: string) {
    console.log(`更新任务日志: id=${id}, status=${status}, result=${result}`);
    await this.db.prepare(
      'UPDATE task_logs SET status = ?, result = ?, end_time = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(status, result, id).run();
  }

  private async executeHTTPTask(task: Task): Promise<string> {
    try {
      console.log(`执行 HTTP 任务: ${task.command}, 方法: ${task.http_method}, 超时: ${task.timeout}`);
      const method = task.http_method === 1 ? 'GET' : 'POST';
      
      const options: RequestInit = {
        method,
        timeout: (task.timeout || 60) * 1000,
      };

      if (task.request_headers) {
        try {
          const headers = JSON.parse(task.request_headers);
          options.headers = headers;
          console.log(`使用自定义请求头:`, headers);
        } catch (error) {
          console.error(`解析请求头失败:`, error);
        }
      }

      if (method === 'POST' && task.request_body) {
        options.body = task.request_body;
        console.log(`使用请求体:`, task.request_body);
      }

      const response = await fetch(task.command, options);

      const body = await response.text();
      console.log(`HTTP 任务响应状态: ${response.status}`);
      return `HTTP ${response.status}: ${body}`;
    } catch (error) {
      console.error(`HTTP 任务执行失败:`, error);
      throw new Error(`HTTP 请求失败: ${error.message}`);
    }
  }
}
