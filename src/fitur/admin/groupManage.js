const { groupId } = require('../../config');

async function handleGroupManage(sock) {
  sock.ev.on('messages.upsert', async (event) => {
    try {
      for (const message of event.messages) {
        // Proses hanya pesan dari grup dan bukan dari bot
        if (message.key.fromMe) continue;
        const chatId = message.key.remoteJid;
        if (chatId !== groupId) continue;

        // Ambil teks pesan (dari conversation atau extendedTextMessage)
        let text = '';
        if (message.message.conversation) {
          text = message.message.conversation;
        } else if (message.message.extendedTextMessage?.text) {
          text = message.message.extendedTextMessage.text;
        }
        if (!text) continue;
        text = text.trim().toLowerCase();

        // Proses perintah "cl" (close) atau "op" (open)
        if (text === 'cl' || text === 'op') {
          // Verifikasi apakah pengirim adalah admin di grup
          const metadata = await sock.groupMetadata(groupId);
          const senderId = message.key.participant; // ID admin dalam grup
          const isAdmin = metadata.participants.some(
            p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin')
          );
          if (!isAdmin) {
            await sock.sendMessage(chatId, { text: 'Maaf, fitur ini hanya dapat digunakan oleh admin grup.' });
            continue;
          }

          // Bangun quoted message agar reply ke pesan "cl" atau "op"
          const quotedMsg = { ...message };

          // Ambil tanggal dan waktu sesuai timezone Asia/Jakarta (WIB)
          const now = new Date();
          const tanggal = now.toLocaleDateString('id-ID', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            timeZone: 'Asia/Jakarta'
          });
          const waktu = now.toLocaleTimeString('id-ID', {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            timeZone: 'Asia/Jakarta', hour12: false
          });

          if (text === 'cl') {
            // Ubah setting grup ke "announcement" (grup ditutup: hanya admin yang bisa kirim pesan)
            await sock.groupSettingUpdate(chatId, 'announcement');

            const closeMessage =
`╭─❒ 「 🔒 𝗚𝗥𝗨𝗣 𝗗𝗜𝗧𝑼𝗧𝑼𝗣 」  
│ 📆 𝑇𝑎𝑛𝑔𝑔𝑎𝑙: ${tanggal}  
│ ⏰ 𝑊𝑎𝑘𝑡𝑢: ${waktu}  
│ 🌐 𝑆𝑡𝑎𝑡𝑢𝑠: 𝐎𝐟𝐟𝐥𝐢𝐧𝐞  
│ 🛒 𝑇𝑟𝑎𝑛𝑠𝑎𝑘𝑠𝑖: 𝐕𝐢𝐚 𝐀𝐝𝐦𝐢𝐧  
╰───────────────❍  

📌 Terima kasih atas kepercayaan kalian!  
Untuk pemesanan atau pertanyaan, hubungi admin.  
Pastikan semua transaksi hanya melalui admin resmi ✅`;

            await sock.sendMessage(chatId, { text: closeMessage }, { quoted: quotedMsg });
          } else if (text === 'op') {
            // Ubah setting grup ke "not_announcement" (grup dibuka: semua anggota bisa kirim pesan)
            await sock.groupSettingUpdate(chatId, 'not_announcement');

            const openMessage =
`╭─❒ 「 🔓 𝗚𝗥𝗨𝗣 𝗞𝗘𝗠𝗕𝗔𝗟𝗜 𝗗𝗜𝗕𝗨𝗞𝗔 」  
│ 📆 𝑇𝑎𝑛𝑔𝑔𝑎𝑙: ${tanggal}  
│ ⏰ 𝑊𝑎𝑘𝑡𝑢: ${waktu}  
│ 🌐 𝑆𝑡𝑎𝑡𝑢𝑠: 𝐎𝐧𝐥𝐢𝐧𝐞  
│ 🛒 𝑇𝑟𝑎𝑛𝑠𝑎𝑘𝑠𝑖: 𝐀𝐤𝐭𝐢𝐟  
╰───────────────❍  

📢 Selamat datang kembali!
Grup telah dibuka kembali. Silakan berdiskusi dan bertransaksi seperti biasa.  
Pastikan selalu transaksi hanya melalui admin resmi ✅`;

            await sock.sendMessage(chatId, { text: openMessage }, { quoted: quotedMsg });
          }
        }
      }
    } catch (err) {
      // Abaikan error untuk menjaga output minimal
    }
  });
}

module.exports = { handleGroupManage };
