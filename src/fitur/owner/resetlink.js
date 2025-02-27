const { groupId } = require('../../config');

async function handleResetLink(sock) {
  sock.ev.on('messages.upsert', async (event) => {
    for (const message of event.messages) {
      // Hanya proses pesan yang tidak dikirim oleh bot
      if (message.key.fromMe) continue;
      // Proses hanya di chat pribadi (bukan grup)
      const sender = message.key.remoteJid;
      if (sender.endsWith('@g.us')) continue;
      
      // Ambil teks pesan dari conversation atau extendedTextMessage
      let text = "";
      if (message.message.conversation) {
        text = message.message.conversation;
      } else if (message.message.extendedTextMessage?.text) {
        text = message.message.extendedTextMessage.text;
      }
      text = text.trim().toLowerCase();
      if (text !== "resetlink") continue;
      
      // Verifikasi bahwa pengirim adalah admin di grup target
      try {
        const groupMeta = await sock.groupMetadata(groupId);
        const isAdmin = groupMeta.participants.some(p =>
          p.id === sender && (p.admin === "admin" || p.admin === "superadmin")
        );
        if (!isAdmin) {
          await sock.sendMessage(sender, { text: "Anda tidak memiliki izin untuk mereset link grup." });
          continue;
        }
      } catch (err) {
        console.error("Error verifying admin for resetlink:", err);
        await sock.sendMessage(sender, { text: "Terjadi kesalahan saat memverifikasi status admin." });
        continue;
      }
      
      // Reset link undangan grup
      try {
        const result = await sock.groupRevokeInvite(groupId);
        // result bisa berupa string atau objek, tergantung versi Baileys
        const newInvite = typeof result === "string" ? result : result.code;
        const newLink = "https://chat.whatsapp.com/" + newInvite;
        await sock.sendMessage(sender, { text: `Link grup berhasil direset.\nLink baru: ${newLink}` });
      } catch (err) {
        console.error("Error resetting group link:", err);
        await sock.sendMessage(sender, { text: "Terjadi kesalahan saat mereset link grup." });
      }
    }
  });
}

module.exports = { handleResetLink };
