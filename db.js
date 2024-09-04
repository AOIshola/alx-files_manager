import { MongoClient } from 'mongodb';
import { env } from 'process';

class DBClient {
  constructor() {
    const host = env.DB_HOST || 'localhost';
    const port = env.DB_PORT || 27017;
    const database = env.DB_DATABASE || 'files_manager';

    // mongodb://localhost:27017
    const uri = `mongodb://${host}:${port}/${database}`;
    this.dbClient = new MongoClient(uri, { useUnifiedTopology: true });
    this.dbClient.connect()
      .then(() => {
        this.db = this.dbClient.db(database);
      })
      .catch((err) => {
        console.error('Failed to connect to MongoDB', err);
        this.db = null;
      });
  }

  isAlive() {
    return this.dbClient.isConnected();
  }

  async nbUsers() {
    return this.db.collection('users').countDocuments();
  }

  async nbFiles() {
    return this.db.collection('files').countDocuments();
  }
}

const dbClient = new DBClient();
export default dbClient;
