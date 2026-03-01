import { Queue, Worker } from "bullmq";

const connection = {
  url: process.env.REDIS_URL!,
  maxRetriesPerRequest: null as null,
};

export function createQueue(name: string) {
  return new Queue(name, { connection });
}

export function createWorker(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  processor: (job: any) => Promise<any>,
  opts?: { concurrency?: number; limiter?: { max: number; duration: number } },
) {
  const worker = new Worker(name, processor, {
    connection,
    ...opts,
  });

  const shutdown = async () => {
    await worker.close();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return worker;
}
