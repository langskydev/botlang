const { groupId } = require('../../config');

async function handleOrderProcess(sock) {
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
        
        // Kita proses hanya jika teks adalah "p" atau "d"
        if (text !== 'p' && text !== 'd') continue;
        
        // Pastikan pesan adalah reply (harus memiliki contextInfo dengan stanzaId dan participant)
        const contextInfo = message.message.extendedTextMessage?.contextInfo;
        if (!contextInfo || !contextInfo.stanzaId || !contextInfo.participant) continue;
        
        // Verifikasi bahwa pengirim perintah adalah admin di grup
        const metadata = await sock.groupMetadata(groupId);
        const senderId = message.key.participant; // ID admin yang mengirim perintah
        const isAdmin = metadata.participants.some(
          p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin')
        );
        if (!isAdmin) continue;
        
        // Ambil ID pembeli dari contextInfo (yaitu, pesan yang di-reply)
        const buyerId = contextInfo.participant;
        
        // Ambil waktu sekarang dengan format tanggal & waktu WIB
        const now = new Date();
        const tanggal = now.toLocaleDateString('id-ID', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        });
        const waktu = now.toLocaleTimeString('id-ID', {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          timeZone: 'Asia/Jakarta', hour12: false
        });
        
        // Bangun objek quoted message untuk reply ke pesan yang di-reply admin
        const quotedMsg = {
          key: {
            remoteJid: chatId,
            id: contextInfo.stanzaId,
            fromMe: false,
            participant: contextInfo.participant
          },
          message: contextInfo.quotedMessage
        };
        
        if (text === 'p') {
          // Buat pesan pending
          const pendingMessage =
`╭─❒ 「 ⏳ 𝗣𝗘𝗡𝗗𝗜𝗡𝗚 」  
│ 📆 𝑇𝑎𝑛𝑔𝑔𝑎𝑙: ${tanggal}  
│ ⏰ 𝑊𝑎𝑘𝑡𝑢: ${waktu}  
│ 🚫 𝑆𝑡𝑎𝑡𝑢𝑠: Pending  
│ 👤 𝑃𝑒𝑚𝑏𝑒𝑙𝑖: @${buyerId.split('@')[0]}  
│ 📩 𝑅𝑒𝑠𝑝𝑜𝑛: 𝐀𝐤𝐚𝐧 𝐝𝐢𝐩𝐫𝑜𝐬𝐞𝐬 𝐬𝐞𝐠𝐞𝐫𝐚  
╰───────────────❍  

📢 Harap bersabar!
Pesan dalam antrian dan akan segera diproses.`;
          
          await sock.sendMessage(chatId, { text: pendingMessage, mentions: [buyerId] }, { quoted: quotedMsg });
        }
        else if (text === 'd') {
          // Buat pesan sukses
          const successMessage =
`╭─❒ 「 ✅ 𝗕𝗘𝗥𝗛𝗔𝗦𝗜𝗟 」  
│ 📆 𝑇𝑎𝑛𝑔𝑔𝑎𝑙: ${tanggal}  
│ ⏰ 𝑊𝑎𝑘𝑡𝑢: ${waktu}  
│ 📦 𝑆𝑡𝑎𝑡𝑢𝑠: 𝐃𝐎𝐍𝐄  
╰───────────────❍  

🎉 Terima kasih, @${buyerId.split('@')[0]}  
Pesananmu telah berhasil diproses. Jika ada kendala, silakan hubungi admin. Jangan lupa order lagi! ✅`;
          
          await sock.sendMessage(chatId, { text: successMessage, mentions: [buyerId] }, { quoted: quotedMsg });
        }
      }
    } catch (err) {
      // Abaikan error agar console tetap minimal
    }
  });
}

module.exports = { handleOrderProcess };
