import cronParser from 'cron-parser';

// 测试不同格式的 cron 表达式
const testCronExpressions = [
  // 逗号分割的多个值
  '0 0 9,10,16,17 * * *',
  // 范围值
  '0 0 9-17 * * *',
  // 分钟级任务
  '* * * * *'
];

// 测试日期：上海时间 2026/02/10 11:14:00（UTC 2026/02/10 03:14:00）
const testDate = new Date('2026-02-10T03:14:00Z');
console.log(`测试日期: ${testDate.toISOString()}`);

// 测试每个 cron 表达式
testCronExpressions.forEach((expression, index) => {
  console.log(`\n=== 测试 cron 表达式 ${index + 1}: ${expression} ===`);
  
  try {
    // 检查 cron 表达式是否是 6 位格式（包含秒字段）
    const cronParts = expression.trim().split(/\s+/);
    let specToParse = expression;
    
    if (cronParts.length === 6) {
      // 6 位格式：秒 分 时 日 月 星期
      // cron-parser 默认支持 5 位格式，需要跳过秒字段
      specToParse = cronParts.slice(1).join(' ');
      console.log(`检测到 6 位 cron 表达式，跳过秒字段: ${specToParse}`);
    } else if (cronParts.length === 5) {
      // 5 位格式：分 时 日 月 星期
      specToParse = expression;
      console.log(`检测到 5 位 cron 表达式`);
    }
    
    // 解析 cron 表达式，设置时区为上海
    const interval = cronParser.parseExpression(specToParse, { tz: 'Asia/Shanghai', currentDate: testDate });
    
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
