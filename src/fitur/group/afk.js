// /src/fitur/group/afk.js
const groupConfig = require('../../groupConfig');
const afkStatus = {};

module.exports = {
  handleAfk: async (sock, m) => {
    const sender = m.key.participant || m.key.remoteJid;
    if (!groupConfig.admins.includes(sender)) return;

    // Pastikan teks mention menggunakan format yang valid
    const adminMention = `@${sender.split('@')[0]}`;

    // Dapatkan konten pesan
    const messageContent = m.message.conversation || m.message.extendedTextMessage?.text;
    if (!messageContent) return;

    // Ambil metadata grup untuk mention semua member
    const groupMetadata = await sock.groupMetadata(m.key.remoteJid);
    const allMembers = groupMetadata.participants.map(p => p.jid);

    // Jika admin sudah AFK, maka pesan apapun dianggap sebagai tanda "kembali"
    if (afkStatus[sender]) {
      const storedReason = afkStatus[sender];
      const returnMessage = `${adminMention} telah kembali dari afk\nReason: ${storedReason}`;
      await sock.sendMessage(
        m.key.remoteJid,
        { text: returnMessage, mentions: allMembers },
        { quoted: m }
      );
      await sock.groupSettingUpdate(m.key.remoteJid, 'not_announcement');
      delete afkStatus[sender];
      return;
    }

    // Periksa perintah AFK (".afk" atau "afk/")
    const commandRegex = /^(\.afk|afk\/)(\s+)?/i;
    if (commandRegex.test(messageContent)) {
      const reasonText = messageContent.replace(commandRegex, '').trim() || 'Tidak ada alasan';
      afkStatus[sender] = reasonText;
      const afkMessage = `${adminMention} sedang afk\nAlasan: ${reasonText}`;
      await sock.sendMessage(
        m.key.remoteJid,
        { text: afkMessage, mentions: allMembers },
        { quoted: m }
      );
      await sock.groupSettingUpdate(m.key.remoteJid, 'announcement');
    }
  }
};
