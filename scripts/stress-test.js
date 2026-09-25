const http = require('http');

const BASE_URL = 'http://localhost:3000';

const TEST_CASES = [
  { name: 'items-list', path: '/api/monitor/items?limit=15', method: 'GET' },
  { name: 'items-forecast', path: '/api/monitor/items?view=forecast&limit=50', method: 'GET' },
  { name: 'items-grouped', path: '/api/monitor/items?view=grouped', method: 'GET' },
  { name: 'dashboard', path: '/api/monitor/dashboard?days=14&topN=20', method: 'GET' },
  { name: 'status', path: '/api/monitor/status', method: 'GET' },
  { name: 'sources', path: '/api/monitor/sources', method: 'GET' },
];

const CONCURRENCY_STAGES = [
  { concurrency: 10, duration: 10, label: '低负载' },
  { concurrency: 50, duration: 15, label: '中负载' },
  { concurrency: 100, duration: 20, label: '高负载' },
  { concurrency: 200, duration: 30, label: '峰值负载' },
];

async function makeRequest(testCase) {
  const start = Date.now();
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: testCase.path,
      method: testCase.method,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const duration = Date.now() - start;
        resolve({
          success: res.statusCode >= 200 && res.statusCode < 300,
          statusCode: res.statusCode,
          duration,
          size: data.length,
        });
      });
    });

    req.on('error', (err) => {
      const duration = Date.now() - start;
      resolve({
        success: false,
        statusCode: 0,
        duration,
        error: err.message,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const duration = Date.now() - start;
      resolve({
        success: false,
        statusCode: 408,
        duration,
        error: 'timeout',
      });
    });

    req.end();
  });
}

async function runStage(concurrency, duration, testCase) {
  const results = [];
  const startTime = Date.now();
  let completed = 0;
  let running = 0;

  const runRequest = async () => {
    while (Date.now() - startTime < duration * 1000) {
      while (running >= concurrency) {
        await new Promise(r => setTimeout(r, 1));
      }
      running++;
      const result = await makeRequest(testCase);
      results.push(result);
      running--;
      completed++;
    }
  };

  const workers = Array.from({ length: concurrency }, () => runRequest());
  await Promise.all(workers);

  const elapsed = (Date.now() - startTime) / 1000;
  const successCount = results.filter(r => r.success).length;
  const errorCount = results.length - successCount;
  const durations = results.map(r => r.duration);
  
  const p50 = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.5)] || 0;
  const p95 = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)] || 0;
  const p99 = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.99)] || 0;
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length || 0;
  const max = Math.max(...durations) || 0;

  const errorCodes = {};
  results.filter(r => !r.success).forEach(r => {
    errorCodes[r.statusCode] = (errorCodes[r.statusCode] || 0) + 1;
  });

  return {
    completed,
    elapsed,
    rps: completed / elapsed,
    successRate: (successCount / completed * 100).toFixed(2),
    avgDuration: avg.toFixed(2),
    p50: p50.toFixed(2),
    p95: p95.toFixed(2),
    p99: p99.toFixed(2),
    maxDuration: max.toFixed(2),
    errorCount,
    errorCodes,
  };
}

async function runStressTest() {
  console.log('\n========================================');
  console.log('  政策监测系统全链路压力测试');
  console.log('========================================\n');

  for (const testCase of TEST_CASES) {
    console.log(`\n────────────────────────────────────────`);
    console.log(`  测试接口: ${testCase.name}`);
    console.log(`  请求路径: ${testCase.path}`);
    console.log(`────────────────────────────────────────\n`);

    let allResults = [];

    for (const stage of CONCURRENCY_STAGES) {
      console.log(`  [阶段] ${stage.label} (并发: ${stage.concurrency}, 时长: ${stage.duration}s)`);
      const result = await runStage(stage.concurrency, stage.duration, testCase);
      allResults.push({ ...stage, ...result });

      console.log(`    完成请求: ${result.completed}`);
      console.log(`    RPS: ${result.rps.toFixed(2)}`);
      console.log(`    成功率: ${result.successRate}%`);
      console.log(`    响应时间(ms): avg=${result.avgDuration} p50=${result.p50} p95=${result.p95} p99=${result.p99} max=${result.maxDuration}`);
      if (result.errorCount > 0) {
        console.log(`    错误数: ${result.errorCount} (${JSON.stringify(result.errorCodes)})`);
      }
      console.log('');
    }

    const maxRps = Math.max(...allResults.map(r => r.rps));
    const minSuccessRate = Math.min(...allResults.map(r => parseFloat(r.successRate)));
    const maxP95 = Math.max(...allResults.map(r => parseFloat(r.p95)));

    console.log(`  [汇总]`);
    console.log(`    最大 RPS: ${maxRps.toFixed(2)}`);
    console.log(`    最低成功率: ${minSuccessRate}%`);
    console.log(`    最高 P95: ${maxP95}ms`);
    console.log('');
  }

  console.log('========================================');
  console.log('  压力测试完成');
  console.log('========================================\n');
}

runStressTest().catch(console.error);