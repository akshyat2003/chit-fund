import app from './app.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Enterprise Chit Fund Platform Backend Server`);
  console.log(` Running on port: http://localhost:${PORT}`);
  console.log(` API Endpoint: http://localhost:${PORT}/api/v1/health`);
  console.log(`=======================================================`);
});
