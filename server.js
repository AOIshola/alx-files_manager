import { env } from 'process';
import express from 'express';
import router from './routes';

const PORT = env.PORT || 5000;
const app = express();

app.use(express.json())
app.use(router);

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server is running on port ${PORT}`);
});
