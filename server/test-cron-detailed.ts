import cronParser from 'cron-parser';

// 测试不同格式的 cron 表达式
const testCronExpressions = [
  // 逗号分割的多个值
  {
    name: '逗号分割 - 9,10,16,17点',
    expression: '0 0 9,10,16,17 * * 1'
  },
  // 范围值
  {
    name: '范围值 - 9-17点',
    expression: '0 0 9-17 * * 1'
  },
  // 分钟级任务
  {
    name: '分钟级任务',
    expression: '* * * * *'
  },
  // 小时级任务
  {
    name: '小时级任务 - 每小时',
    expression: '0 * * * *'
  },
  // 天级任务
  {
    name: '天级任务 - 每天12点',
    expression: '0 0 12 * * *'
  },
  // 周级任务
  {
    name: '周级任务 - 每周日12点',
    expression: '0 0 12 * * 0'
  },
  // 月级任务
  {
    name: '月级任务 - 每月1日12点',
    expression: '0 0 12 1 * *'
  }
];

// 测试日期
const testDate = new Date('2026-02-10T10:00:00Z');
console.log(`测试基准日期: ${testDate.toISOString()}`);

// 测试每个 cron 表达式
testCronExpressions.forEach((testCase, index) => {
  console.log(`\n=== 测试 ${index + 1}: ${testCase.name} ===`);
  console.log(`Cron 表达式: ${testCase.expression}`);
  
  try {
    // 检查 cron 表达式是否是 6 位格式（包含秒字段）
    const cronParts = testCase.expression.trim().split(/\s+/);
    let specToParse = testCase.expression;
    
    if (cronParts.length === 6) {
      // 6 位格式：秒 分 时 日 月 星期
      // cron-parser 默认支持 5 位格式，需要跳过秒字段
      specToParse = cronParts.slice(1).join(' ');
      console.log(`检测到 6 位 cron 表达式，跳过秒字段: ${specToParse}`);
    } else if (cronParts.length === 5) {
      // 5 位格式：分 时 日 月 星期
      specToParse = testCase.expression;
      console.log(`检测到 5 位 cron 表达式`);
    }
    
    // 解析 cron 表达式，设置时区为 UTC
    const interval = cronParser.parseExpression(specToParse, { utc: true, currentDate: testDate });
    
    // 获取下 5 个执行时间
    console.log('下 5 个执行时间:');
    for (let i = 0; i < 5; i++) {
      const nextRun = interval.next().toDate();
      console.log(`${i + 1}. ${nextRun.toISOString()}`);
    }
  } catch (error) {
    console.error('解析 cron 表达式失败:', error);
  }
});

// 测试任务列表中的 cron 解析逻辑
console.log('\n=== 测试任务列表中的 cron 解析逻辑 ===');

// 模拟任务数据
const mockTasks = [
  {
    id: 1,
    name: '测试任务 1',
    spec: '0 0 9,10,16,17 * * 1'
  },
  {
    id: 2,
    name: '测试任务 2',
    spec: '0 0 9-17 * * 1'
  }
];

mockTasks.forEach(task => {
  console.log(`\n处理任务: ${task.id} - ${task.name}`);
  console.log(`Cron 表达式: ${task.spec}`);
  
  try {
    // 检查 cron 表达式是否是 6 位格式（包含秒字段）
    const cronParts = task.spec.trim().split(/\s+/);
    let specToParse = task.spec;
    
    if (cronParts.length === 6) {
      // 6 位格式：秒 分 时 日 月 星期
      // cron-parser 默认支持 5 位格式，需要跳过秒字段
      specToParse = cronParts.slice(1).join(' ');
      console.log(`检测到 6 位 cron 表达式，跳过秒字段: ${specToParse}`);
    } else if (cronParts.length === 5) {
      // 5 位格式：分 时 日 月 星期
      specToParse = task.spec;
      console.log(`检测到 5 位 cron 表达式`);
    }
    
    const interval = cronParser.parseExpression(specToParse, { utc: true });
    const nextRun = interval.next().toDate();
    console.log(`下次执行时间: ${nextRun.toISOString()}`);
  } catch (e) {
    console.log('下次执行时间: 无效表达式');
  }
});
