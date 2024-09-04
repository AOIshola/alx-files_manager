import Bull from 'bull';
import imageThumbnail from 'image-thumbnail';
import fs from 'fs';
import { promisify } from 'util';
import path from 'path';
import dbClient from './utils/db';

const writeFile = promisify(fs.writeFile);

const fileQueue = new Bull('fileQueue');

fileQueue.process(async (job, done) => {
  const { userId, fileId } = job.data;

  if (!fileId) {
    throw new Error('Missing fileId');
  }
  if (!userId) {
    throw new Error('Missing userId');
  }

  const file = await dbClient.db.collection('files').findOne({ _id: new dbClient.ObjectID(fileId), userId });

  if (!file) {
    throw new Error('File not found');
  }

  const sizes = [500, 250, 100];
  const filePath = file.localPath;

  for (const size of sizes) {
    const thumbnail = await imageThumbnail(filePath, { width: size });
    const newFileName = `${path.parse(filePath).name}_${size}${path.extname(filePath)}`;
    const thumbnailPath = path.join(path.dirname(filePath), newFileName);
    await writeFile(thumbnailPath, thumbnail);
  }

  done();
});
