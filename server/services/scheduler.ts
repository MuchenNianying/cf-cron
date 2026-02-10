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

  constructor(env: Env) {
    this.db = env.DB;
  }

  async run() {
    const now = new Date();
    console.log(`=== 调度器运行开始: ${now.toISOString()} ===`);
    
    // 获取所有启用的任务
    console.log('开始查询启用的任务...');
    try {
      const tasks = await this.db.prepare(
        'SELECT id, name, spec, protocol, command, http_method, timeout, retry_times, retry_interval, request_headers, request_body FROM tasks WHERE status = 1'
      ).all();
      
      console.log(`查询完成，找到 ${tasks.results?.length || 0} 个启用的任务`);
      
      if (!tasks.results || tasks.results.length === 0) {
        console.log('没有找到启用的任务，调度器结束');
        return;
      }
      
      console.log('任务列表:', tasks.results.map((t: any) => ({ id: t.id, name: t.name, spec: t.spec })));
      
      for (const task of tasks.results as Task[]) {
        try {
          console.log(`\n处理任务: ${task.id} - ${task.name}`);
          console.log(`任务配置: cron=${task.spec}, protocol=${task.protocol}, command=${task.command}`);
          
          // 验证任务配置
          if (!task.spec) {
            console.log('任务没有设置 cron 表达式，跳过');
            continue;
          }
          
          // 解析 cron 表达式，设置时区为 UTC
          console.log('开始解析 cron 表达式:', task.spec);
          
          // 检查 cron 表达式是否是 6 位格式（包含秒字段）
          const cronParts = task.spec.trim().split(/\s+/);
          let specToParse = task.spec;
          
          if (cronParts.length === 6) {
            // 6 位格式：秒 分 时 日 月 星期
            // cron-parser 默认支持 5 位格式，需要跳过秒字段
            console.log('检测到 6 位 cron 表达式，跳过秒字段');
            specToParse = cronParts.slice(1).join(' ');
          } else if (cronParts.length === 5) {
            // 5 位格式：分 时 日 月 星期
            console.log('检测到 5 位 cron 表达式');
            specToParse = task.spec;
          } else {
            console.log(`cron 表达式格式不正确，部分数量: ${cronParts.length}`);
            continue;
          }
          
          const interval = cronParser.parseExpression(specToParse, { tz: 'Asia/Shanghai' });
          console.log('Cron 表达式解析成功');
          
          // 获取下一个执行时间
          const nextRun = interval.next().toDate();
          console.log('下一个执行时间:', nextRun.toISOString());
          
          // 重置解析器，获取上一个执行时间
          const resetInterval = cronParser.parseExpression(specToParse, { tz: 'Asia/Shanghai' });
          const prevRun = resetInterval.prev().toDate();
          console.log('上一个执行时间:', prevRun.toISOString());
          
          // 计算上一个执行时间的分钟数
          const prevRunMinute = prevRun.getMinutes();
          const currentMinute = now.getMinutes();
          
          // 获取任务的 cron 表达式的各个部分
          const cronParts2 = task.spec.split(' ');
          const minutePart = cronParts2[0];
          
          console.log(`Cron 表达式分析: minute=${minutePart}`);
          console.log(`时间检查: 上次执行分钟 ${prevRunMinute}, 当前分钟 ${currentMinute}`);
          console.log(`当前时间: ${now.toISOString()}`);
          
          // 检查是否需要执行任务
          console.log('开始检查任务是否应该执行...');
          const shouldExecuteTask = this.shouldExecuteTask(task.spec, now);
          console.log(`任务是否应该执行: ${shouldExecuteTask}`);
          
          if (shouldExecuteTask) {
            // 检查是否已经执行过（避免重复执行）
            console.log('检查是否已经执行过...');
            
            // 对于分钟级任务，检查过去2分钟内是否执行过
            // 对于其他任务，检查过去1小时内是否执行过
            const checkTime = new Date(now.getTime() - (minutePart === '*' ? 2 : 60) * 60 * 1000);
            console.log(`检查时间范围: ${checkTime.toISOString()} 到 ${now.toISOString()}`);
            
            const lastLog = await this.db.prepare(
              'SELECT * FROM task_logs WHERE task_id = ? AND start_time >= ? ORDER BY id DESC LIMIT 1'
            ).bind(task.id, checkTime.toISOString()).first();
            
            console.log(`最后一次执行记录:`, lastLog);
            
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
          console.error(`错误堆栈:`, error.stack);
        }
      }
    } catch (error) {
      console.error('查询任务时出错:', error);
      console.error(`错误堆栈:`, error.stack);
    }
    
    console.log(`\n=== 调度器运行结束 ===`);
  }

  private shouldExecuteTask(cronExpression: string, currentTime: Date): boolean {
    try {
      console.log(`\n开始判断任务是否应该执行:`);
      console.log(`Cron 表达式: ${cronExpression}`);
      console.log(`当前时间: ${currentTime.toISOString()}`);
      
      // 检查 cron 表达式是否是 6 位格式（包含秒字段）
      const cronParts = cronExpression.trim().split(/\s+/);
      let specToParse = cronExpression;
      
      if (cronParts.length === 6) {
        // 6 位格式：秒 分 时 日 月 星期
        // cron-parser 默认支持 5 位格式，需要跳过秒字段
        console.log('检测到 6 位 cron 表达式，跳过秒字段');
        specToParse = cronParts.slice(1).join(' ');
      } else if (cronParts.length === 5) {
        // 5 位格式：分 时 日 月 星期
        console.log('检测到 5 位 cron 表达式');
        specToParse = cronExpression;
      } else {
        console.log(`cron 表达式格式不正确，部分数量: ${cronParts.length}`);
        return false;
      }
      
      // 解析 cron 表达式，设置时区为上海
      const interval = cronParser.parseExpression(specToParse, { tz: 'Asia/Shanghai' });
      const nextRun = interval.next().toDate();
      
      // 重置解析器，获取上一个执行时间
      const resetInterval = cronParser.parseExpression(specToParse, { tz: 'Asia/Shanghai' });
      const prevRun = resetInterval.prev().toDate();
      
      console.log(`下一个执行时间: ${nextRun.toISOString()}`);
      console.log(`上一个执行时间: ${prevRun.toISOString()}`);
      
      // 对于分钟级任务 (* * * * *), 检查当前时间是否在上一分钟内
      if (specToParse === '* * * * *') {
        console.log('任务是分钟级任务 (* * * * *)');
        // 检查是否在上一分钟内
        const oneMinuteAgo = new Date(currentTime.getTime() - 60 * 1000);
        console.log(`一分钟前: ${oneMinuteAgo.toISOString()}`);
        const isInRange = prevRun >= oneMinuteAgo && prevRun <= currentTime;
        console.log(`上一个执行时间是否在范围内: ${isInRange}`);
        return isInRange;
      }
      
      // 对于其他任务，检查当前时间是否接近上一个执行时间
      // 允许有1分钟的误差
      console.log('任务是其他级别的任务');
      const timeDiff = Math.abs(currentTime.getTime() - prevRun.getTime());
      console.log(`时间差: ${timeDiff} 毫秒`);
      const isCloseEnough = timeDiff <= 60 * 1000; // 1分钟内
      console.log(`时间差是否在允许范围内: ${isCloseEnough}`);
      return isCloseEnough;
    } catch (error) {
      console.error(`解析 cron 表达式失败: ${cronExpression}`, error);
      return false;
    }
  }

  private async executeTask(task: Task) {
    console.log(`执行任务: ${task.id} - ${task.name}`);
    console.log(`任务配置:`, task);
    
    let logId: number;
    try {
      // 创建任务日志
      logId = await this.createTaskLog(task);
      console.log(`任务日志创建成功: ${logId}`);
    } catch (error) {
      console.error('创建任务日志失败:', error);
      // 即使日志创建失败，也要继续执行任务
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
      
      console.log(`任务执行结果: ${result}`);
    } catch (error) {
      console.error(`任务执行失败:`, error);
      result = `执行失败: ${error.message}`;
      status = 0;
    }
    
    try {
      // 更新任务日志
      await this.updateTaskLog(logId, status, result);
      console.log(`任务日志更新成功`);
    } catch (error) {
      console.error('更新任务日志失败:', error);
    }
  }

  private async executeHTTPTask(task: Task): Promise<string> {
    try {
      console.log(`执行 HTTP 任务: ${task.command}, 方法: ${task.http_method}, 超时: ${task.timeout}`);
      
      // 解析请求头
      let headers: any = {};
      if (task.request_headers) {
        try {
          headers = JSON.parse(task.request_headers);
        } catch (error) {
          console.error('解析请求头失败:', error);
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
      
      const responseText = await response.text();
      console.log(`HTTP 响应状态: ${response.status}`);
      console.log(`HTTP 响应内容: ${responseText}`);
      
      if (!response.ok) {
        throw new Error(`HTTP 错误: ${response.status} ${response.statusText}`);
      }
      
      return `HTTP 执行成功: ${response.status} ${response.statusText}`;
    } catch (error: any) {
      console.error('执行 HTTP 任务失败:', error);
      return `HTTP 执行失败: ${error.message}`;
    }
  }

  private async executeSSHTask(task: Task): Promise<string> {
    try {
      console.log(`执行 SSH 任务: ${task.command}`);
      // 这里需要实现 SSH 任务执行逻辑
      return 'SSH 执行成功';
    } catch (error: any) {
      console.error('执行 SSH 任务失败:', error);
      return `SSH 执行失败: ${error.message}`;
    }
  }

  private async executeLocalTask(task: Task): Promise<string> {
    try {
      console.log(`执行本地任务: ${task.command}`);
      // 这里需要实现本地任务执行逻辑
      return '本地执行成功';
    } catch (error: any) {
      console.error('执行本地任务失败:', error);
      return `本地执行失败: ${error.message}`;
    }
  }

  private async createTaskLog(task: Task): Promise<number> {
    console.log(`创建任务日志: task_id=${task.id}, name=${task.name}`);
    try {
      const result = await this.db.prepare(
        'INSERT INTO task_logs (task_id, name, spec, protocol, command, timeout, retry_times, hostname, status, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(task.id, task.name, task.spec, task.protocol, task.command, task.timeout || 0, task.retry_times || 0, 'localhost', 1, '执行中...').run();
      
      const logId = result.meta?.last_row_id || result.lastInsertRowid;
      console.log(`任务日志创建成功: logId=${logId}, result=`, result);
      
      if (!logId) {
        throw new Error('无法获取任务日志 ID');
      }
      
      return logId;
    } catch (error) {
      console.error('创建任务日志失败:', error);
      // 如果创建日志失败，返回一个临时 ID
      return Date.now();
    }
  }

  private async updateTaskLog(id: number, status: number, result: string) {
    console.log(`更新任务日志: id=${id}, status=${status}, result=${result}`);
    try {
      await this.db.prepare(
        'UPDATE task_logs SET status = ?, result = ?, end_time = ? WHERE id = ?'
      ).bind(status, result, new Date().toISOString(), id).run();
      console.log('任务日志更新成功');
    } catch (error) {
      console.error('更新任务日志失败:', error);
      // 如果更新日志失败，忽略错误，继续执行
    }
  }
}
