const { Framework, createClient, z } = require("../Package/dist/index.js");
const { performance } = require("perf_hooks");

const app = new Framework();

for (let i = 0; i < 500; i++) {
  app.get(`/route/${i}`, () => Response.json({ route: i }), {
    response: z.object({ route: z.number() }),
  });
}

app.listen(3022);
const client = createClient("http://localhost:3022");

(async () => {
  const startTime = performance.now();
  const startMemory = process.memoryUsage().heapUsed;

  for (let i = 0; i < 500; i++) {
    const { data } = await client.route[i].get();
    if (data.route !== i) {
      throw new Error(`Route ${i} failed`);
    }
  }

  const endTime = performance.now();
  const endMemory = process.memoryUsage().heapUsed;

  const totalTime = endTime - startTime;
  const averageTime = totalTime / 500;
  const usedMemoryMB = ((endMemory - startMemory) / 1024 / 1024).toFixed(2);

  console.log(`500 routes took ${totalTime.toFixed(2)}ms`);
  console.log(`Average: ${averageTime.toFixed(2)}ms / route`);
  console.log(`Memory used: ${usedMemoryMB} MB`);

  app.close();
})();
