import sha1 from 'sha1';
import dbClient from '../utils/db';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    const userExists = await dbClient.db.collection('users').findOne({ email });

    if (userExists) {
      res.status(400).json({ error: 'Already exists' });
    }

    const hashedPassword = sha1(password);
    const newUser = {
      email,
      password: hashedPassword,
    };

    const result = await dbClient.db.collection('users').insertOne(newUser);
    const userId = result.insertedId;

    return res.status(201).json({ email, id: userId });
  }

  static async getMe(req, res) {
    const token = req.header['x-token'];
    const key = `auth_${token}`;

    const userId = await redisClient.get(key);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await dbClient.db.collection('users').findOne({ _id: new dbClient.ObjectId(userId) });
    const { email, _id } = user;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.status(200).json({ id: _id, email });
  }
}

export default UsersController;
