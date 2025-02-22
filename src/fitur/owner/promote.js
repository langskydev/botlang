// src/fitur/owner/promote.js
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const groupConfig = require('../../groupConfig');

let promotionInterval = null; // Variabel untuk menyimpan ID interval promosi

async function handlePromote(sock, m) {
  try {
    // Ambil isi pesan dari berbagai properti, termasuk caption jika berupa image
    const messageContent =
      m.message.conversation ||
      (m.message.extendedTextMessage && m.message.extendedTextMessage.text) ||
      (m.message.imageMessage && m.message.imageMessage.caption);
    if (!messageContent) return;

    // Validasi: hanya admin yang terdaftar di groupConfig.admins yang diperbolehkan
    const sender = m.key.remoteJid;
    if (!groupConfig.admins.includes(sender)) {
      await sock.sendMessage(sender, { text: "Anda tidak memiliki izin untuk menggunakan fitur ini." });
      return;
    }

    // Perintah berhenti promosi: "stoppromote"
    if (messageContent.toLowerCase().trim() === "stoppromote") {
      if (promotionInterval) {
        clearInterval(promotionInterval);
        promotionInterval = null;
        await sock.sendMessage(sender, { text: "Promosi telah dihentikan." });
      } else {
        await sock.sendMessage(sender, { text: "Promosi tidak sedang berjalan." });
      }
      return;
    }

    // Pastikan pesan diawali dengan "promote|"
    if (!messageContent.startsWith("promote|")) return;

    // Pisahkan perintah dan teks promosi
    const parts = messageContent.split("|");
    if (parts.length < 2) {
      await sock.sendMessage(sender, { text: "Format perintah salah. Gunakan: promote|teks promosi" });
      return;
    }
    const promoteText = parts.slice(1).join("|").trim();
    if (!promoteText) {
      await sock.sendMessage(sender, { text: "Teks promosi tidak boleh kosong." });
      return;
    }

    // Cek apakah pesan admin mengandung gambar
    let imageBuffer = null;
    if (m.message.imageMessage) {
      const stream = await downloadContentFromMessage(m.message.imageMessage, 'image');
      const bufferArray = [];
      for await (const chunk of stream) {
        bufferArray.push(chunk);
      }
      imageBuffer = Buffer.concat(bufferArray);
    }

    // Ambil daftar semua grup yang diikuti bot
    let groups;
    try {
      groups = await sock.groupFetchAllParticipating();
    } catch (error) {
      console.error("Error fetching participating groups:", error);
      await sock.sendMessage(sender, { text: "Gagal mengambil daftar grup. Promosi dibatalkan." });
      return;
    }
    const allGroupIds = Object.keys(groups);
    // Target grup: semua grup kecuali yang ada di groupConfig.allowedGroups
    const targetGroupIds = allGroupIds.filter(id => !groupConfig.allowedGroups.includes(id));

    // Fungsi untuk mengirim promo ke satu grup
    async function sendPromo(groupId, groupData) {
      let mentions = [];
      if (groupData && groupData.participants) {
        mentions = groupData.participants.map(p => p.id);
      }
      const payload = imageBuffer
        ? { image: imageBuffer, caption: promoteText, mentions }
        : { text: promoteText, mentions };
      try {
        await sock.sendMessage(groupId, payload);
      } catch (error) {
        console.error(`Gagal mengirim promo ke grup ${groupId}:`, error);
      }
    }

    // Kirim pesan awal ke seluruh target grup secara paralel (tanpa delay)
    await Promise.all(targetGroupIds.map(async groupId => {
      const groupData = groups[groupId];
      await sendPromo(groupId, groupData);
    }));

    // Konfirmasi ke admin bahwa pesan awal telah dikirim
    await sock.sendMessage(sender, { 
      text: `Promosi telah dikirim ke ${targetGroupIds.length} grup. Pesan akan dikirim ulang setiap ${groupConfig.promotionInterval / 60000} menit.` 
    });

    // Hentikan interval promosi jika sedang berjalan
    if (promotionInterval) {
      clearInterval(promotionInterval);
    }

    // Set interval untuk mengirim ulang pesan sesuai konfigurasi
    promotionInterval = setInterval(async () => {
      try {
        let groupsInterval;
        try {
          groupsInterval = await sock.groupFetchAllParticipating();
        } catch (error) {
          console.error("Error fetching groups in interval:", error);
          return;
        }
        const groupIdsInterval = Object.keys(groupsInterval).filter(id => !groupConfig.allowedGroups.includes(id));
        await Promise.all(groupIdsInterval.map(async groupId => {
          const groupData = groupsInterval[groupId];
          await sendPromo(groupId, groupData);
        }));
      } catch (error) {
        console.error("Error saat mengirim pesan ulang promosi:", error);
      }
    }, groupConfig.promotionInterval);

  } catch (err) {
    console.error("Error pada fitur promote:", err);
  }
}

module.exports = { handlePromote };
