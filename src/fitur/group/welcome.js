// /src/fitur/group/welcome.js
const groupConfig = require('../../groupConfig.js'); // sesuaikan path jika perlu
const welcomedMembers = {};

const welcomeHandler = async (sock, update) => {
  try {
    const { id, participants, action } = update;
    if (action !== "add") return; // Hanya proses event "add" (anggota baru)

    // Hanya aktif jika grup ini sudah dikonfigurasi di groupConfig.js
    if (!groupConfig.allowedGroups.includes(id)) return;

    const groupMeta = await sock.groupMetadata(id);
    const groupName = groupMeta.subject;
    
    // Inisialisasi cache untuk grup jika belum ada
    if (!welcomedMembers[id]) {
      welcomedMembers[id] = new Set();
    }

    for (const participant of participants) {
      // Jika member sudah disambut sebelumnya, lewati
      if (welcomedMembers[id].has(participant)) continue;
      
      // Tandai member sebagai sudah disambut
      welcomedMembers[id].add(participant);

      // Kirim pesan welcome sekali saja
      await sock.sendMessage(id, {
        text: `🎉 Selamat Datang di *${groupName}*! 🎉

Hai, @${participant.split("@")[0]}! 👋 Senang kamu bergabung di sini. Untuk melihat daftar harga dan aplikasi yang tersedia, ketik *list*.  

Jika ada pertanyaan, jangan ragu untuk bertanya. Selamat berbelanja! 🚀`,
        mentions: [participant],
      });
    }
  } catch (error) {
    console.error("Error in welcomeHandler:", error);
  }
};

module.exports = { welcomeHandler };
