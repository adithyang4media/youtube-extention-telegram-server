import express from 'express';
import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import fetch from 'node-fetch';
import cors from 'cors'
dotenv.config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const PORT = process.env.PORT || 3000;

app.use(cors()); // 👈 Allow cross-origin requests
app.use(express.json({ limit: '10mb' }));

app.post('/send-image', async (req, res) => {
    console.log('Image Send Request received for image', req.body.filename)
  try {
    const { dataURI, filename = 'image.png' } = req.body;

    if (!dataURI || !dataURI.startsWith('data:image')) {
      return res.status(400).json({ error: 'Invalid or missing image dataURI' });
    }

    // Convert dataURI to Buffer
    const base64 = dataURI.split(',')[1];
    const buffer = Buffer.from(base64, 'base64');

    await bot.telegram.sendDocument(process.env.TARGET_CHAT_ID, {
      source: buffer,
      filename,
    });

    res.json({ sucess : true, status: 'Image sent as document!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sucess : false, error: 'Failed to send image' });
  }
});

// Optional: Webhook or polling init
app.get('/', (req, res) => res.send('Bot server running!'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
