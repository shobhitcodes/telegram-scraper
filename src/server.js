// lib imports
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const compression = require('compression');

const router = express.Router();

// load environment variables
const { DATABASE_URL, PORT = 8000 } = process.env;

// if (!DATABASE_URL) {
//   throw new Error('DATABASE_URL env variable not set');
// }

// express app initialization
const app = express();

app.use(helmet());
app.use(cors({ exposedHeaders: 'x-auth' }));
app.use(morgan('combined'));
app.use(express.json({ limit: '5mb' }));
app.use(compression());

// mongoDB connection
// mongoose.connect(DATABASE_URL);
// const db = mongoose.connection;
// db.on('error', (error) => console.log('db connection err: ', error));
// db.once('open', () => console.log('mongoose connected'));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
  next();
});

// rate Limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use(limiter);

// use routes
app.use('/', router);

router.get('/', (req, res) => {
  res.send('scraper in action');
});

app.use((req, res, next) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

process.on('exit', (code) => {
  console.log(`Process exited with code ${code}`);
});
