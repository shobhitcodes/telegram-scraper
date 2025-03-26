// lib imports
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const compression = require('compression');
const moment = require('moment');

const router = express.Router();

// load environment variables
const { DATABASE_URL, PORT = 8000, TELEGRAM_API_ID, TELEGRAM_API_HASH } = process.env;

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');

const apiId = +TELEGRAM_API_ID;
const apiHash = TELEGRAM_API_HASH;
const session = new StringSession('');

// connect telegram
const client = new TelegramClient(session, apiId, apiHash, { connectionRetries: 5 });

async function login() {
  console.log('Logging in...');
  await client.start({
    phoneNumber: async () => await input.text('Enter your phone number: '),
    password: async () => await input.text('Enter your 2FA password (if enabled): '),
    phoneCode: async () => await input.text('Enter the OTP sent to Telegram: '),
    onError: (err) => console.log('Error:', err),
  });

  console.log('Logged in successfully!');
  console.log('Session:', client.session.save());
}

login();

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

app.get('/groups', async (req, res) => {
  try {
    let dialogs = await client.getDialogs();
    let groups = dialogs.filter((dialog) => dialog.isGroup);
    groups = groups.map((group) => ({
      id: group.id,
      name: group.title,
    }));
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/group/:id/stats', async (req, res) => {
  try {
    const groupId = Number(req.params.id);
    const oneWeekAgo = moment().subtract(1, 'week').startOf('day');
    let totalMessages = 0;
    let botMessages = 0;
    let uniqueUsers = new Set();
    const messages = await client.getMessages(groupId, { limit: 500 });
    const justMessages = messages.filter((messages) => messages.message || messages.media);

    justMessages.forEach((msg) => {
      const msgDate = moment.unix(msg.date);

      if (msgDate.isBefore(oneWeekAgo)) return;

      totalMessages++;

      if (msg.viaBotId) {
        botMessages++;
      }

      if (msg.fromId && msg.fromId.userId && msg.fromId.userId.value) {
        uniqueUsers.add(msg.fromId.userId.value);
      }
    });

    res.json({
      totalMessages,
      botMessages,
      uniqueUsers: uniqueUsers.size,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
