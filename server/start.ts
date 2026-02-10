import cron from 'node-cron';
import { Scheduler } from './services/scheduler.ts';

// 默认 SECRET_KEY
const secretKey = 'your-secret-key';

// 尝试获取环境变量
let env;
try {
  // 检查是否在 Cloudflare Workers 环境中
  if (typeof process !== 'undefined' && process.env && process.env.CF_WORKER) {
    // 在 Cloudflare Workers 环境中，使用全局环境变量
    console.log('在 Cloudflare Workers 环境中运行');
    env = {
      DB: globalThis.DB,
      SECRET_KEY: globalThis.SECRET_KEY || secretKey
    };
    console.log('成功获取 Cloudflare Workers 环境变量和数据库连接');
  } else {
    // 尝试使用 wrangler 提供的本地开发数据库
    try {
      const { getPlatformProxy } = await import('wrangler');
      
      // 注意：getPlatformProxy() 返回的是一个 Promise
      const platform = await getPlatformProxy();
      
      // 检查平台对象的结构
      console.log('平台对象:', platform);
      
      // 检查是否有 env 属性
      if (platform && platform.env) {
        console.log('平台 env 对象:', platform.env);
        
        // 检查是否有 DB 连接
        if (platform.env.DB) {
          env = platform.env;
          console.log('成功获取 wrangler 本地开发环境和数据库连接');
        } else {
          console.log('wrangler 本地开发环境中没有 DB 连接，使用模拟环境变量');
          env = {
            DB: {
              prepare: (sql: string) => {
                console.log('执行 SQL:', sql);
                return {
                  all: async () => {
                    console.log('执行 all() 方法');
                    return {
                      results: []
                    };
                  },
                  first: async () => {
                    console.log('执行 first() 方法');
                    return null;
                  },
                  run: async () => {
                    console.log('执行 run() 方法');
                    return {
                      meta: {
                        last_row_id: Date.now()
                      }
                    };
                  },
                  bind: function(...params: any[]) {
                    console.log('绑定参数:', params);
                    return this;
                  }
                };
              }
            },
            SECRET_KEY: secretKey
          };
        }
      } else {
        console.log('wrangler 本地开发环境中没有 env 属性，使用模拟环境变量');
        env = {
          DB: {
            prepare: (sql: string) => {
              console.log('执行 SQL:', sql);
              return {
                all: async () => {
                  console.log('执行 all() 方法');
                  return {
                    results: []
                  };
                },
                first: async () => {
                  console.log('执行 first() 方法');
                  return null;
                },
                run: async () => {
                  console.log('执行 run() 方法');
                  return {
                    meta: {
                      last_row_id: Date.now()
                    }
                  };
                },
                bind: function(...params: any[]) {
                  console.log('绑定参数:', params);
                  return this;
                }
              };
            }
          },
          SECRET_KEY: secretKey
        };
      }
    } catch (error) {
      console.log('无法获取 wrangler 本地开发环境，使用模拟环境变量:', error.message);
      
      // 使用模拟环境变量
      env = {
        DB: {
          prepare: (sql: string) => {
            console.log('执行 SQL:', sql);
            return {
              all: async () => {
                console.log('执行 all() 方法');
                return {
                  results: []
                };
              },
              first: async () => {
                console.log('执行 first() 方法');
                return null;
              },
              run: async () => {
                console.log('执行 run() 方法');
                return {
                  meta: {
                    last_row_id: Date.now()
                  }
                };
              },
              bind: function(...params: any[]) {
                console.log('绑定参数:', params);
                return this;
              }
            };
          }
        },
        SECRET_KEY: secretKey
      };
    }
  }
} catch (error) {
  console.log('无法获取环境变量，使用模拟环境变量:', error.message);
  
  // 使用模拟环境变量
  env = {
    DB: {
      prepare: (sql: string) => {
        console.log('执行 SQL:', sql);
        return {
          all: async () => {
            console.log('执行 all() 方法');
            return {
              results: []
            };
          },
          first: async () => {
            console.log('执行 first() 方法');
            return null;
          },
          run: async () => {
            console.log('执行 run() 方法');
            return {
              meta: {
                last_row_id: Date.now()
              }
            };
          },
          bind: function(...params: any[]) {
            console.log('绑定参数:', params);
            return this;
          }
        };
      }
    },
    SECRET_KEY: secretKey
  };
}

// 创建调度器实例
const scheduler = new Scheduler(env);

// 检查是否为测试模式
const isTestMode = process.argv.includes('--test');

if (isTestMode) {
  console.log('=== 测试模式：执行一次定时任务后退出 ===');
  try {
    await scheduler.run();
    console.log('定时任务测试执行成功');
    process.exit(0);
  } catch (error) {
    console.error('定时任务测试执行失败:', error);
    process.exit(1);
  }
} else {
  // 每分钟执行一次定时任务
  const task = cron.schedule('* * * * *', async () => {
    console.log('=== Node.js 定时任务触发 ===');
    try {
      await scheduler.run();
      console.log('定时任务执行成功');
    } catch (error) {
      console.error('定时任务执行失败:', error);
    }
  });

  console.log('Node.js 定时任务服务已启动');
  console.log('每分钟执行一次定时任务');
  console.log('按 Ctrl+C 停止服务');

  // 监听终止信号
  process.on('SIGINT', () => {
    console.log('\n正在停止定时任务服务...');
    task.stop();
    console.log('定时任务服务已停止');
    process.exit(0);
  });
}
