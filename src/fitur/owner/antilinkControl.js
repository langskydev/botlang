const { groupId } = require('../../config');
const state = require('../../state');

async function handleAntilinkControl(sock) {
  sock.ev.on('messages.upsert', async (event) => {
    for (const message of event.messages) {
      if (message.key.fromMe) continue;
      // Proses hanya di chat pribadi (bukan grup)
      const sender = message.key.remoteJid;
      if (sender.endsWith('@g.us')) continue;
      
      let text = "";
      if (message.message.conversation) {
        text = message.message.conversation;
      } else if (message.message.extendedTextMessage?.text) {
        text = message.message.extendedTextMessage.text;
      }
      if (!text) continue;
      text = text.trim().toLowerCase();
      
      if (text !== "antilink of" && text !== "antilink on") continue;
      
      // Verifikasi admin: ambil metadata grup untuk memeriksa pengirim
      try {
        const groupMeta = await sock.groupMetadata(groupId);
        const isAdmin = groupMeta.participants.some(p =>
          p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')
        );
        if (!isAdmin) {
          await sock.sendMessage(sender, { text: "Anda tidak memiliki izin untuk mengubah status antilink." });
          continue;
        }
      } catch (err) {
        await sock.sendMessage(sender, { text: "Terjadi kesalahan saat memverifikasi admin." });
        continue;
      }
      
      if (text === "antilink of") {
        state.antilinkEnabled = false;
        await sock.sendMessage(sender, { text: "Fitur antilink telah dinonaktifkan." });
      } else if (text === "antilink on") {
        state.antilinkEnabled = true;
        await sock.sendMessage(sender, { text: "Fitur antilink telah diaktifkan." });
      }
    }
  });
}

module.exports = { handleAntilinkControl };
