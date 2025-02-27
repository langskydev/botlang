const { groupId } = require('../../config');

async function handleRename(sock) {
  sock.ev.on('messages.upsert', async (event) => {
    for (const message of event.messages) {
      // Hanya proses pesan dari chat pribadi (bukan grup)
      if (message.key.fromMe) continue;
      const remoteJid = message.key.remoteJid;
      if (remoteJid.endsWith('@g.us')) continue; // lewati pesan grup

      // Ambil teks pesan dari conversation atau extendedTextMessage
      let text = "";
      if (message.message.conversation) {
        text = message.message.conversation;
      } else if (message.message.extendedTextMessage?.text) {
        text = message.message.extendedTextMessage.text;
      }
      text = text.trim();
      if (!text.toLowerCase().startsWith("rename |")) continue;

      // Parsing teks perintah
      const parts = text.split("|");
      if (parts.length < 2) {
        await sock.sendMessage(remoteJid, { text: "Format tidak valid. Gunakan: rename | namagrub" });
        continue;
      }
      const newGroupName = parts.slice(1).join("|").trim();
      if (!newGroupName) {
        await sock.sendMessage(remoteJid, { text: "Nama grup tidak boleh kosong." });
        continue;
      }

      try {
        // Ambil metadata grup untuk verifikasi admin
        const groupMeta = await sock.groupMetadata(groupId);
        // Di chat pribadi, remoteJid adalah ID pengirim (misal: 12345@s.whatsapp.net)
        const senderId = remoteJid;
        const isAdmin = groupMeta.participants.some(p =>
          p.id === senderId && (p.admin === "admin" || p.admin === "superadmin")
        );
        if (!isAdmin) {
          await sock.sendMessage(remoteJid, { text: "Anda tidak memiliki izin untuk merubah nama grup." });
          continue;
        }

        // Update nama grup
        await sock.groupUpdateSubject(groupId, newGroupName);
        await sock.sendMessage(remoteJid, { text: `Nama grup berhasil diubah menjadi "${newGroupName}".` });
      } catch (err) {
        console.error("Error in rename feature:", err);
        await sock.sendMessage(remoteJid, { text: "Terjadi kesalahan saat mengganti nama grup." });
      }
    }
  });
}

module.exports = { handleRename };
