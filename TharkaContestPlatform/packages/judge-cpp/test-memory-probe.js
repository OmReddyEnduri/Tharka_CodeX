// Plain-Node assertion tests for the child-memory sampler (memoryProbe.js).
// No test framework in this repo - same standalone-script style as
// test-checkers.js. Run:
//   node test-memory-probe.js
//
// What this is really guarding is the bug that made it necessary: the memory
// limit used to be enforced by pidusage, whose Windows backend shells out to
// `wmic.exe` - a tool that is deprecated and absent on current Windows builds.
// Every sample failed there, the failure was swallowed, and the memory limit
// was silently never enforced at all, which let a runaway allocation take a
// whole lab machine down. So the first test below is the important one: this
// machine must actually be able to measure a process's memory.
const assert = require('assert');
const { spawn } = require('child_process');

const { sampleMemoryKb, startMemoryWatch, describeProbe } = require('./memoryProbe');

let passCount = 0;
let failCount = 0;

async function test(label, fn) {
  try {
    await fn();
    console.log(`  ok  - ${label}`);
    passCount++;
  } catch (err) {
    console.error(`FAIL - ${label}: ${err.message}`);
    failCount++;
  }
}

// A child that allocates steadily and touches every page it takes, so the
// pages are resident and therefore visible to a working-set reading.
function spawnAllocator(totalMb) {
  const perIterationMb = 4;
  const iterations = Math.ceil(totalMb / perIterationMb);
  return spawn(
    process.execPath,
    [
      '-e',
      `const a=[];for(let i=0;i<${iterations};i++)a.push(Buffer.alloc(${perIterationMb}*1024*1024,1));setTimeout(()=>{},60000)`,
    ],
    { windowsHide: true }
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  console.log('Sampler:');
  console.log(`  (platform mechanism: ${describeProbe()})`);

  await test('reports a plausible memory reading for a live process', async () => {
    const kb = await sampleMemoryKb(process.pid);
    assert.ok(typeof kb === 'number', `expected a number, got ${kb}`);
    // This very process is well over 1MB resident by now; anything smaller
    // means the reading is bogus rather than merely approximate.
    assert.ok(kb > 1024, `expected > 1024 KB for a live node process, got ${kb}`);
  });

  await test('reports a non-empty probe description', async () => {
    assert.ok(typeof describeProbe() === 'string' && describeProbe().length > 0);
  });

  await test('returns null (not a throw) for a process that does not exist', async () => {
    const kb = await sampleMemoryKb(2147483646);
    assert.strictEqual(kb, null);
  });

  await test('returns null rather than throwing for a null pid', async () => {
    assert.strictEqual(await sampleMemoryKb(null), null);
  });

  await test('measures a real child process, not just itself', async () => {
    const child = spawnAllocator(96);
    try {
      await sleep(1200);
      const kb = await sampleMemoryKb(child.pid);
      assert.ok(typeof kb === 'number', `expected a number, got ${kb}`);
      // It was asked for ~96MB; anything under 16MB means we measured the
      // wrong thing (or nothing at all).
      assert.ok(kb > 16 * 1024, `expected > 16MB for a 96MB allocator, got ${kb} KB`);
    } finally {
      child.kill();
    }
  });

  console.log('\nWatch:');

  await test('fires onExceeded once when a child passes the limit', async () => {
    const child = spawnAllocator(160);
    let fires = 0;
    let reason = null;
    const watch = startMemoryWatch(child.pid, {
      intervalMs: 200,
      limitMb: 32,
      onExceeded: (peakKb, why) => {
        fires++;
        reason = why;
      },
    });
    try {
      await sleep(4000);
      assert.strictEqual(fires, 1, `expected exactly 1 call, got ${fires}`);
      // 'limit' is the program's own working set; 'system' means the machine's
      // free memory was being consumed instead. Both are valid enforcement -
      // which one wins depends on the machine's free memory at the time.
      assert.ok(reason === 'limit' || reason === 'system', `unexpected reason ${reason}`);
    } finally {
      watch.stop();
      child.kill();
    }
  });

  await test('does not fire for a child that stays well inside the limit', async () => {
    const child = spawnAllocator(16);
    let fires = 0;
    const watch = startMemoryWatch(child.pid, {
      intervalMs: 200,
      limitMb: 512,
      onExceeded: () => {
        fires++;
      },
    });
    try {
      await sleep(2000);
      assert.strictEqual(fires, 0, 'should not have fired');
      assert.ok(watch.peakKb() >= 0, 'peakKb must always be a number');
    } finally {
      watch.stop();
      child.kill();
    }
  });

  await test('stop() halts firing, and stop() twice is safe', async () => {
    const child = spawnAllocator(160);
    let fires = 0;
    const watch = startMemoryWatch(child.pid, {
      intervalMs: 200,
      limitMb: 32,
      onExceeded: () => {
        fires++;
      },
    });
    // Stopped immediately, so the over-limit child should never be reported.
    watch.stop();
    watch.stop();
    try {
      await sleep(2000);
      assert.strictEqual(fires, 0, 'a stopped watch must not call onExceeded');
    } finally {
      child.kill();
    }
  });

  await test('processProbe:false never samples the pid (jobrun mode - system backstop only)', async () => {
    const child = spawnAllocator(160);
    let fires = 0;
    const watch = startMemoryWatch(child.pid, {
      intervalMs: 200,
      limitMb: 32,
      processProbe: false,
      onExceeded: () => {
        fires++;
      },
    });
    try {
      await sleep(2000);
      // Over its 32MB "limit", but per-process enforcement is off; only the
      // system floor could fire, and 160MB cannot drain a machine to it.
      assert.strictEqual(fires, 0, 'per-process limit must not be enforced');
      assert.strictEqual(watch.peakKb(), 0, 'no process samples should have been taken');
    } finally {
      watch.stop();
      child.kill();
    }
  });

  console.log(`\n${passCount} passed, ${failCount} failed`);
  if (failCount > 0) process.exit(1);
})();
