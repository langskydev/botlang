const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { groupId } = require('../../config');

const hidetag = async (sock, message) => {
  try {
    // Pastikan pesan memiliki properti 'message'
    if (!message.message) return;
    
    // Pastikan pesan dikirim di dalam grup
    const remoteJid = message.key.remoteJid;
    if (!remoteJid.endsWith('@g.us')) return;
    
    // Ambil teks dari pesan. Prioritas: imageMessage.caption > conversation > extendedTextMessage.text
    let text = "";
    if (message.message.imageMessage) {
      text = message.message.imageMessage.caption || "";
    } else if (message.message.conversation) {
      text = message.message.conversation;
    } else if (message.message.extendedTextMessage?.text) {
      text = message.message.extendedTextMessage.text;
    }
    text = text.trim();
    
    // Proses hanya jika teks diawali dengan "h" atau ".h"
    if (!(text.startsWith('.h') || text.startsWith('h'))) return;
    
    // Ekstrak teks perintah (teks setelah prefix)
    let commandText = "";
    if (text.startsWith('.h ')) {
      commandText = text.slice(3).trim();
    } else if (text.startsWith('.h')) {
      commandText = text.slice(2).trim();
    } else if (text.startsWith('h ')) {
      commandText = text.slice(2).trim();
    } else if (text.startsWith('h')) {
      commandText = text.slice(1).trim();
    }
    
    if (!commandText) {
      await sock.sendMessage(remoteJid, { text: "Silakan masukkan teks setelah perintah .h" });
      return;
    }
    
    // Verifikasi bahwa pengirim adalah admin grup
    const groupMeta = await sock.groupMetadata(remoteJid);
    const senderId = message.key.participant;
    const isAdmin = groupMeta.participants.some(
      (p) => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin')
    );
    if (!isAdmin) {
      await sock.sendMessage(remoteJid, { text: "Fitur hidetag hanya dapat digunakan oleh admin grup." });
      return;
    }
    
    // Ambil semua anggota grup untuk mention
    const mentions = groupMeta.participants.map((p) => p.id);
    
    // Jika pesan memiliki gambar, unduh dan kirim ulang gambar dengan caption; jika tidak, kirim hanya teks.
    if (message.message.imageMessage) {
      const imageMsg = message.message.imageMessage;
      const stream = await downloadContentFromMessage(imageMsg, "image");
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }
      await sock.sendMessage(remoteJid, { image: buffer, caption: commandText, mentions });
    } else {
      await sock.sendMessage(remoteJid, { text: commandText, mentions });
    }
  } catch (err) {
    console.error("Error in hidetag feature:", err);
  }
};

module.exports = { hidetag };
