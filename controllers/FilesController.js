import { v4 as uuidv4 } from 'uuid';
import Bull from 'bull';
import fs from 'fs';
import { promisify } from 'util';
import mime from 'mime-types';
import path from 'path';
import { ObjectId } from 'mongodb';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

const fileQueue = new Bull('fileQueue');

class FilesController {
  static async postUpload(req, res) {
    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    if (parentId !== 0) {
      const parentFile = await dbClient.db.collection('files').findOne({ _id: new dbClient.ObjectID(parentId) });
      if (!parentFile) return res.status(400).json({ error: 'Parent not found' });
      if (parentFile.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
    }

    if (type === 'folder') {
      const newFile = {
        userId, name, type, parentId, isPublic,
      };
      await dbClient.db.collection('files').insertOne(newFile);
      return res.status(201).json(newFile);
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    await mkdir(folderPath, { recursive: true });

    const fileUuid = uuidv4();
    const localPath = path.join(folderPath, fileUuid);
    const fileBuffer = Buffer.from(data, 'base64');

    await writeFile(localPath, fileBuffer);

    const newFile = {
      userId,
      name,
      type,
      isPublic,
      parentId,
      localPath,
    };

    const result = await dbClient.db.collection('files').insertOne(newFile);
    const fileId = result.insertedId.toString();
    if (type === 'image') {
      fileQueue.add({ userId: user._id.toString(), fileId });
    }
    return res.status(201).json(newFile);
  }

  static async getShow(res, req) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId), userId });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(file);
  }

  static async getIndex(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parentId = req.query.parentId || '0';
    const page = parseInt(req.query.page, 10) || 0;
    const pageSize = 20;
    const skip = page * pageSize;

    const files = await dbClient.db.collection('files').aggregate([
      { $match: { parentId, userId } },
      { $skip: skip },
      { $limit: pageSize },
    ]).toArray();

    return res.status(200).json(files);
  }

  static async putPublish(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({ _id: new dbClient.ObjectID(fileId), userId: new dbClient.ObjectID(userId) });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await dbClient.db.collection('files').updateOne({ _id: file._id }, { $set: { isPublic: true } });
    return res.status(200).json({ ...file, isPublic: true });
  }

  static async putUnpublish(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({ _id: new dbClient.ObjectID(fileId), userId: new dbClient.ObjectID(userId) });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await dbClient.db.collection('files').updateOne({ _id: file._id }, { $set: { isPublic: false } });
    return res.status(200).json({ ...file, isPublic: false });
  }

  static async getFile(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    const fileId = req.params.id;

    const file = await dbClient.db.collection('files').findOne({ _id: new dbClient.ObjectID(fileId) });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (!file.isPublic && (!userId || file.userId.toString() !== userId)) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    const localPath = file.localPath;

    try {
      const content = await readFile(localPath, { encoding: 'utf-8' });
      const mimeType = mime.lookup(file.name) || 'application/octet-stream';

      res.setHeader('Content-Type', mimeType);
      return res.status(200).send(content);
    } catch (err) {
      return res.status(404).json({ error: 'Not found' });
    }
  }
}

export default FilesController;
