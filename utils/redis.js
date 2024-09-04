import { createClient } from 'redis';

class RedisClient {
  constructor() {
    this.client = createClient();
    this.client.on('error', (err) => {
      console.log(err);
    });

    this.client.on('connect', () => {});
  }

  isAlive() {
    return this.client.connected;
  }

  async get(key) {
    return new Promise((resolve, reject) => {
      this.client.get(key, (err, value) => {
        if (err) {
          reject(err);
        } else {
          resolve(value);
        }
      });
    });
  }

  async set(key, value, duration) {
    return new Promise((res, rej) => {
      this.client.setex(key, duration, value, (err) => {
        if (err) {
          rej(err);
        } else {
          res('OK');
        }
      });
    });
  }

  async del(key) {
    return new Promise((resolve, reject) => {
      this.client.del(key, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve('OK');
        }
      });
    });
  }
}

const redisClient = new RedisClient();
export default redisClient;
