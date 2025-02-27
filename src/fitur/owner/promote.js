const { groupId } = require('../../config');

// Inisialisasi antrian promosi dan status
let promotionQueue = [];
let isCooldown = false;
let promoteEnabled = true; // Status default aktif

// Asynchronous function untuk mengambil semua ID grup kecuali grup utama
async function getAllGroupIds(sock) {
  try {
    const groupsData = await sock.groupFetchAllParticipating();
    let groups = Object.keys(groupsData);
    // Saring agar tidak termasuk grup utama (groupId)
    groups = groups.filter(g => g !== groupId);
    return groups;
  } catch (err) {
    console.error("Error fetching group ids:", err);
    return [];
  }
}

// Fungsi untuk broadcast promosi ke semua grup (kecuali grup utama)
async function broadcastPromotion(sock, promotionText) {
  const groups = await getAllGroupIds(sock);
  for (const gid of groups) {
    await sock.sendMessage(gid, { text: promotionText });
  }
}

// Fungsi untuk memproses antrian promosi dengan jeda 30 menit antar pesan
function processPromotion(sock) {
  if (promotionQueue.length === 0) return;
  const promotionText = promotionQueue.shift();
  // Jika fitur promote nonaktif, jangan broadcast
  if (!promoteEnabled) return;
  broadcastPromotion(sock, promotionText);
  isCooldown = true;
  setTimeout(() => {
    isCooldown = false;
    processPromotion(sock);
  }, 30 * 60 * 1000); // 30 menit
}

async function handlePromote(sock) {
  sock.ev.on('messages.upsert', async (event) => {
    for (const message of event.messages) {
      // Proses hanya pesan dari chat pribadi
      if (message.key.fromMe) continue;
      const sender = message.key.remoteJid;
      if (sender.endsWith('@g.us')) continue; // hanya chat pribadi

      // Ambil teks pesan dari conversation atau extendedTextMessage
      let text = "";
      if (message.message.conversation) {
        text = message.message.conversation;
      } else if (message.message.extendedTextMessage?.text) {
        text = message.message.extendedTextMessage.text;
      }
      if (!text) continue;
      text = text.trim();
      const lowerText = text.toLowerCase();

      // Jika perintah adalah "promoteof", nonaktifkan fitur promote
      if (lowerText === "promoteof") {
        try {
          // Verifikasi admin dengan menggunakan metadata grup utama
          const groupMeta = await sock.groupMetadata(groupId);
          const isAdmin = groupMeta.participants.some(p =>
            p.id === sender && (p.admin === "admin" || p.admin === "superadmin")
          );
          if (!isAdmin) {
            await sock.sendMessage(sender, { text: "Anda tidak memiliki izin untuk mengubah status promote." });
            continue;
          }
        } catch (err) {
          await sock.sendMessage(sender, { text: "Terjadi kesalahan saat memverifikasi status admin." });
          continue;
        }
        promoteEnabled = false;
        await sock.sendMessage(sender, { text: "Fitur promote telah dinonaktifkan." });
        return;
      }
      // Jika perintah adalah "promoteon", aktifkan fitur promote
      if (lowerText === "promoteon") {
        try {
          const groupMeta = await sock.groupMetadata(groupId);
          const isAdmin = groupMeta.participants.some(p =>
            p.id === sender && (p.admin === "admin" || p.admin === "superadmin")
          );
          if (!isAdmin) {
            await sock.sendMessage(sender, { text: "Anda tidak memiliki izin untuk mengubah status promote." });
            continue;
          }
        } catch (err) {
          await sock.sendMessage(sender, { text: "Terjadi kesalahan saat memverifikasi status admin." });
          continue;
        }
        promoteEnabled = true;
        await sock.sendMessage(sender, { text: "Fitur promote telah diaktifkan." });
        // Jika ada promosi tertunda, proses sekarang
        if (!isCooldown && promotionQueue.length > 0) {
          processPromotion(sock);
        }
        return;
      }
      
      // Proses perintah promosi: harus diawali dengan "promote |"
      if (lowerText.startsWith("promote |")) {
        if (!promoteEnabled) {
          await sock.sendMessage(sender, { text: "Fitur promote sedang nonaktif." });
          continue;
        }
        const parts = text.split("|");
        if (parts.length < 2) {
          await sock.sendMessage(sender, { text: "Format tidak valid. Gunakan: promote | teks promosi" });
          continue;
        }
        const promotionText = parts.slice(1).join("|").trim();
        if (!promotionText) {
          await sock.sendMessage(sender, { text: "Teks promosi tidak boleh kosong." });
          continue;
        }
        promotionQueue.push(promotionText);
        await sock.sendMessage(sender, { text: `Promosi telah ditambahkan ke antrian: "${promotionText}"` });
        if (!isCooldown) {
          processPromotion(sock);
        }
      }
    }
  });
}

module.exports = { handlePromote };
