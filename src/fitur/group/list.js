const { groupId } = require('../../config');
const fs = require('fs');
const path = require('path');

async function handleList(sock, message) {
  try {
    const chatId = message.key.remoteJid;
    // Dapatkan sender (dari properti participant jika ada)
    const sender = message.key.participant || message.key.remoteJid;
    const senderName = sender.split('@')[0];

    // Tentukan greeting berdasarkan jam server
    const now = new Date();
    const hour = now.getHours();
    let greeting = 'Selamat Malam';
    if (hour < 12) greeting = 'Selamat Pagi';
    else if (hour < 15) greeting = 'Selamat Siang';
    else if (hour < 18) greeting = 'Selamat Sore';

    // Format jam dan tanggal sesuai locale Indonesia
    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
    const dateOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
    const jam = now.toLocaleTimeString('id-ID', timeOptions);
    const tanggal = now.toLocaleDateString('id-ID', dateOptions);

    // Ambil metadata grup untuk mendapatkan nama grup
    const metadata = await sock.groupMetadata(chatId);
    const groupName = metadata.subject;

    // Baca data produk dari database
    const dataFilePath = path.join(__dirname, '../../../database/listproduct/data.json');
    let productData = {};
    if (fs.existsSync(dataFilePath)) {
      const data = await fs.promises.readFile(dataFilePath, 'utf8');
      productData = JSON.parse(data);
    }

    // Bangun pesan list dengan icon "🛍" untuk setiap produk
    let messageLines = [];
    messageLines.push('┌──⭓「 LIST PRODUK ✓⃝ 」');
    messageLines.push(`│ ${greeting} @${senderName}`);
    let counter = 1;
    for (let productName in productData) {
      messageLines.push(`│${counter}. 🛍 ${productName}`);
      counter++;
    }
    messageLines.push('└────────────⭓');
    messageLines.push(`GRUP : ${groupName}`);
    messageLines.push(`JAM : ⏰ ${jam}`);
    messageLines.push(`TANGGAL : 📆 ${tanggal}`);
    messageLines.push('');
    messageLines.push('NOTE : ');
    messageLines.push('Untuk melihat produk berdasarkan nomor, atau ketik nama produk yang ada pada list di atas.');

    const listMessage = messageLines.join('\n');

    await sock.sendMessage(chatId, { text: listMessage, mentions: [sender] });
  } catch (error) {
    // Error diabaikan agar output console tetap minimal
  }
}

module.exports = { handleList };
