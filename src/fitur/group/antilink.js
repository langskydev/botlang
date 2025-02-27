const { groupId } = require('../../config');
const state = require('../../state');

const linkOffenses = {}; // Menyimpan jumlah pelanggaran per member

async function handleAntilink(sock) {
  sock.ev.on('messages.upsert', async (event) => {
    try {
      // Jika fitur antilink nonaktif, lewati semua pesan
      if (!state.antilinkEnabled) return;

      for (const message of event.messages) {
        if (message.key.fromMe) continue;
        if (!message.message) continue;
        const chatId = message.key.remoteJid;
        if (!chatId.endsWith('@g.us')) continue;
        
        // Ambil teks dari pesan (conversation, extendedTextMessage, atau caption imageMessage)
        let text = "";
        if (message.message.conversation) {
          text = message.message.conversation;
        } else if (message.message.extendedTextMessage?.text) {
          text = message.message.extendedTextMessage.text;
        } else if (message.message.imageMessage?.caption) {
          text = message.message.imageMessage.caption;
        }
        text = text.trim();
        if (!text) continue;
        
        // Deteksi link dengan regex
        const linkRegex = /(http|https|wa\.me|www)/i;
        if (!linkRegex.test(text)) continue;
        
        // Dapatkan metadata grup dan periksa apakah pengirim adalah admin
        const groupMeta = await sock.groupMetadata(chatId);
        const senderId = message.key.participant;
        const isAdmin = groupMeta.participants.some(
          (p) => p.id === senderId && (p.admin === "admin" || p.admin === "superadmin")
        );
        // Jika pengirim adalah admin, lewati pemrosesan
        if (isAdmin) continue;
        
        // Hapus pesan yang mengandung link
        await sock.sendMessage(chatId, { delete: message.key });
        
        // Tingkatkan counter pelanggaran untuk pengirim
        if (!linkOffenses[senderId]) {
          linkOffenses[senderId] = 0;
        }
        linkOffenses[senderId]++;
        
        // Ambil tanggal & waktu dengan timezone Asia/Jakarta (WIB)
        const now = new Date();
        const tanggal = now.toLocaleDateString('id-ID', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          timeZone: 'Asia/Jakarta'
        });
        const waktu = now.toLocaleTimeString('id-ID', {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          timeZone: 'Asia/Jakarta', hour12: false
        });
        
        if (linkOffenses[senderId] < 3) {
          const warningMessage =
`╭─❒ 「 ⚠️ LINK DETECTED 」  
│ 📆 Tanggal: ${tanggal}  
│ ⏰ Waktu: ${waktu}  
│ 🚫 Status: Peringatan ke-${linkOffenses[senderId]}  
│ 👤 Pengirim: @${senderId.split('@')[0]}  
╰───────────────❍  

📢 Harap jangan mengirim link! Jika kamu mengirim link lagi, kamu akan dikeluarkan dari grup.`;
          await sock.sendMessage(chatId, { text: warningMessage, mentions: [senderId] }, { quoted: message });
        } else {
          const kickMessage =
`╭─❒ 「 🚫 𝗞𝗜𝗖𝗞 」  
│ 📆 Tanggal: ${tanggal}  
│ ⏰ Waktu: ${waktu}  
│ ⚠️ Alasan: Pengiriman link berulang  
│ 👤 Pengirim: @${senderId.split('@')[0]}  
╰───────────────❍  

⚠️ Kamu telah melanggar peraturan grup dan akan dikeluarkan.`;
          await sock.sendMessage(chatId, { text: kickMessage, mentions: [senderId] }, { quoted: message });
          await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
        }
      }
    } catch (err) {
      console.error("Error in antilink feature:", err);
    }
  });
}

module.exports = { handleAntilink };
