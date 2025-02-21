// /src/fitur/group/antilink.js

// Impor daftar id grup yang diijinkan
const { allowedGroups } = require('../../groupConfig');

// Objek untuk menyimpan hitungan peringatan per grup dan per anggota
const warningCounts = {};

const antilinkHandler = async (sock, message) => {
  try {
    const remoteJid = message.key.remoteJid;
    // Pastikan hanya diproses jika pesan berasal dari grup
    if (!remoteJid.endsWith('@g.us')) return;
    
    // Cek apakah id grup termasuk dalam daftar yang diijinkan
    if (!allowedGroups.includes(remoteJid)) return;

    // Ambil ID pengirim pesan
    const sender = message.key.participant || message.key.remoteJid;

    // Ambil teks pesan dari pesan teks atau extendedTextMessage
    let text =
      message.message.conversation ||
      message.message.extendedTextMessage?.text ||
      "";
    text = text.trim();

    // Cek apakah pesan mengandung link (http, https, atau wa.me)
    const linkRegex = /(https?:\/\/|wa\.me\/)/i;
    if (!linkRegex.test(text)) return; // Jika tidak ada link, keluar dari fungsi

    // Hapus pesan untuk semua orang
    await sock.sendMessage(remoteJid, { delete: message.key });
    console.log(`Pesan link dari ${sender} dihapus`);

    // Inisialisasi count per grup dan per pengirim jika belum ada
    if (!warningCounts[remoteJid]) warningCounts[remoteJid] = {};
    if (!warningCounts[remoteJid][sender]) warningCounts[remoteJid][sender] = 0;

    // Tambah hitungan peringatan
    warningCounts[remoteJid][sender]++;

    // Jika hitungan peringatan kurang dari 3, kirim pesan peringatan
    if (warningCounts[remoteJid][sender] < 3) {
      await sock.sendMessage(remoteJid, {
        text: `@${sender.split("@")[0]}, jangan kirim link! Peringatan ${warningCounts[remoteJid][sender]}/3`,
        mentions: [sender]
      });
    } else {
      // Jika peringatan mencapai 3x, keluarkan user dari grup
      await sock.sendMessage(remoteJid, {
        text: `@${sender.split("@")[0]} telah dikeluarkan karena terus mengirim link.`,
        mentions: [sender]
      });
      await sock.groupParticipantsUpdate(remoteJid, [sender], 'remove');
      // Reset hitungan peringatan untuk pengirim tersebut
      warningCounts[remoteJid][sender] = 0;
    }
  } catch (error) {
    console.error("Error in antilinkHandler:", error);
  }
};

module.exports = { antilinkHandler };
