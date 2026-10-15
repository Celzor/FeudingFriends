// this contains redis helper code for manageing any objects in redis

import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6399";

export default class Store {
  private static instance: Store;
  private redis: InstanceType<typeof Redis>;

  private constructor() {
    this.redis = new Redis(REDIS_URL);
  }

  public static getInstance(): Store {
    if (!Store.instance) {
      Store.instance = new Store();
    }

    return Store.instance;
  }

  public async connect(): Promise<void> {
    if (this.redis.status === "end") {
      await this.redis.connect();
    }
  }

  public async set(key: string, value: string): Promise<void> {
    await this.redis.set(key, value);
  }

  public async get(key: string): Promise<string | null> {
    return await this.redis.get(key);
  }

  public async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
