const { groupId } = require('../../config');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function handleSetPP(sock) {
  sock.ev.on('messages.upsert', async (event) => {
    for (const message of event.messages) {
      // Proses hanya pesan yang tidak dikirim oleh bot (chat pribadi)
      if (message.key.fromMe) continue;
      const sender = message.key.remoteJid;
      if (sender.endsWith('@g.us')) continue; // hanya chat pribadi

      // Periksa apakah pesan mengandung imageMessage
      if (!message.message.imageMessage) continue;
      
      // Ambil caption dari imageMessage dan periksa apakah tepat "setpp"
      let caption = message.message.imageMessage.caption || "";
      caption = caption.trim().toLowerCase();
      if (caption !== "setpp") continue;
      
      // Verifikasi bahwa pengirim (di chat pribadi) adalah admin di grup target
      try {
        const groupMeta = await sock.groupMetadata(groupId);
        const isAdmin = groupMeta.participants.some(p =>
          p.id === sender && (p.admin === "admin" || p.admin === "superadmin")
        );
        if (!isAdmin) {
          await sock.sendMessage(sender, { text: "Anda tidak memiliki izin untuk mengubah foto profil grup." });
          continue;
        }
      } catch (err) {
        console.error("Error checking admin status:", err);
        await sock.sendMessage(sender, { text: "Terjadi kesalahan saat memverifikasi status admin." });
        continue;
      }
      
      // Download gambar dari pesan
      try {
        const imageMsg = message.message.imageMessage;
        const stream = await downloadContentFromMessage(imageMsg, "image");
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk]);
        }
        // Gunakan fungsi updateProfilePicture (bukan groupUpdateProfilePicture)
        await sock.updateProfilePicture(groupId, buffer);
        await sock.sendMessage(sender, { text: "Foto profil grup berhasil diubah." });
      } catch (err) {
        console.error("Error updating group profile picture:", err);
        await sock.sendMessage(sender, { text: "Terjadi kesalahan saat mengubah foto profil grup." });
      }
    }
  });
}

module.exports = { handleSetPP };
