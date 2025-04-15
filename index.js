import express from 'express';
import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import fetch from 'node-fetch';
import cors from 'cors'
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { message } from 'telegraf/filters';

dotenv.config();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

var domain = null;


const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const PORT = process.env.PORT || 3000;
console.log(__dirname)
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);


app.use(cors()); // 👈 Allow cross-origin requests
app.use(express.json({ limit: '100mb' }));

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


// Handle /start
bot.start((ctx) => {
  ctx.reply('Hey! Send me a message and I’ll echo it back 🔁');
});



// direct URL
// Schedules file deletion after 2 hours
const scheduleDeletion = (filePath) => {
  setTimeout(() => {
    fs.unlink(filePath, (err) => {
      if (err) console.error(`Error deleting ${filePath}:`, err);
      else console.log(`Deleted file ${filePath}`);
    });
  }, 2 * 60 * 60 * 1000); // 2 hours
};

// Handle incoming documents
bot.on('document', async (ctx) => {
  console.log("Bot Received a document");

  try {
    const fileId = ctx.message.document.file_id;
    const filename = ctx.message.document.file_name || 'file.dat';

    // Get file link from Telegram
    const fileLink = await bot.telegram.getFileLink(fileId);
    const response = await fetch(fileLink.href);

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    const totalBytes = Number(response.headers.get('content-length'));
    const ext = path.extname(filename) || '.dat';
    const uuidName = `${uuidv4()}${ext}`;
    const savePath = path.join(UPLOAD_DIR, uuidName);

    const fileStream = fs.createWriteStream(savePath);
    let downloadedBytes = 0;
    let lastSentProgress = 0;

    // Notify user file is downloading
    const infoMsg = await ctx.reply('⏳ Downloading your file...');

    response.body.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      const percent = Math.floor((downloadedBytes / totalBytes) * 100);

      // Only send updates every 10%
      if (percent >= lastSentProgress + 10) {
        lastSentProgress = percent;
        ctx.telegram.editMessageText(ctx.chat.id, infoMsg.message_id, null, `⏬ Downloading: ${percent}%`);
        
      }
    });

    response.body.pipe(fileStream);

    fileStream.on('finish', async () => {
      

      // Create public URL
      const fileUrl = `${process.env.PUBLIC_URL}/files/${uuidName}`;

      await ctx.telegram.editMessageText(ctx.chat.id, infoMsg.message_id, null, `✅ Download complete!\n📄 Here's your link (valid for 2 hours):\n${fileUrl}`);
      // Schedule deletion
      scheduleDeletion(savePath);
    });

    fileStream.on('error', async (err) => {
      console.error('File write error:', err);
      await ctx.reply('❌ Failed to write file.');
    });

  } catch (err) {
    console.error('Error handling document:', err);
    await ctx.reply('❌ Failed to process the document.');
  }
});



bot.on(message('text'), async (ctx) => {
  const userMessage = ctx.message.text;
  console.log('User message:', userMessage);

  await ctx.reply(`📨 You said: ${userMessage}`);
});


// Optional: Webhook or polling init
app.get('/', (req, res) => res.send('Bot server running!'));
app.use('/files', express.static(UPLOAD_DIR));

bot.launch();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
