const fs = require('fs');
const path = require('path');
const groupConfig = require('../../groupConfig');
const forbiddenFilePath = path.join(__dirname, '../../../database/forbiddenWords.json');

// Load data kata terlarang (jika ada), atau inisialisasi Set kosong
let forbiddenWords = new Set();
const loadForbiddenWords = () => {
  try {
    if (fs.existsSync(forbiddenFilePath)) {
      const data = fs.readFileSync(forbiddenFilePath, 'utf8');
      const words = JSON.parse(data);
      if (Array.isArray(words)) {
        forbiddenWords = new Set(words.map(word => word.toLowerCase()));
      }
    }
  } catch (error) {
    console.error("Error loading forbidden words:", error);
  }
};

const saveForbiddenWords = () => {
  try {
    fs.writeFileSync(forbiddenFilePath, JSON.stringify(Array.from(forbiddenWords)), 'utf8');
  } catch (error) {
    console.error("Error saving forbidden words:", error);
  }
};

loadForbiddenWords();

// Objek untuk menyimpan hitungan peringatan per grup & per pengirim
const warningCounts = {};

/**
 * Fungsi untuk memproses perintah admin (chat pribadi ke bot) untuk mengelola kata terlarang.
 * Format perintah:
 * - Add:    "add|kata1 kata2 ..."
 * - Edit:   "edit|kataLama|kataBaru"
 * - Delete: "delete|kata1 kata2 ..."
 */
const handleForbiddenWordCommand = async (sock, message) => {
  try {
    // Proses hanya jika pesan berasal dari chat pribadi (bukan grup)
    if (message.key.remoteJid.endsWith('@g.us')) return;

    let text = message.message.conversation || message.message.extendedTextMessage?.text || "";
    text = text.trim();
    if (!text) return;

    const parts = text.split("|").map(p => p.trim());
    if (parts.length < 2) return; // minimal: command dan parameter

    const command = parts[0].toLowerCase();

    if (command === "add") {
      // Contoh: "add|kata1 kata2 ..."
      const words = parts[1].split(" ").map(w => w.trim().toLowerCase()).filter(Boolean);
      if (words.length === 0) {
        await sock.sendMessage(message.key.remoteJid, { text: "Format salah. Gunakan: add|kata1 kata2 ..." });
        return;
      }
      words.forEach(word => forbiddenWords.add(word));
      saveForbiddenWords();
      await sock.sendMessage(message.key.remoteJid, { text: `Kata terlarang berhasil ditambahkan: ${words.join(", ")}` });
    } else if (command === "edit") {
      // Format: "edit|kataLama|kataBaru"
      if (parts.length < 3) {
        await sock.sendMessage(message.key.remoteJid, { text: "Format salah. Gunakan: edit|kataLama|kataBaru" });
        return;
      }
      const oldWord = parts[1].toLowerCase();
      const newWord = parts[2].toLowerCase();
      if (!forbiddenWords.has(oldWord)) {
        await sock.sendMessage(message.key.remoteJid, { text: `Kata "${oldWord}" tidak ditemukan.` });
        return;
      }
      forbiddenWords.delete(oldWord);
      forbiddenWords.add(newWord);
      saveForbiddenWords();
      await sock.sendMessage(message.key.remoteJid, { text: `Kata "${oldWord}" telah diubah menjadi "${newWord}".` });
    } else if (command === "delete") {
      // Contoh: "delete|kata1 kata2 ..."
      const words = parts[1].split(" ").map(w => w.trim().toLowerCase()).filter(Boolean);
      if (words.length === 0) {
        await sock.sendMessage(message.key.remoteJid, { text: "Format salah. Gunakan: delete|kata1 kata2 ..." });
        return;
      }
      words.forEach(word => forbiddenWords.delete(word));
      saveForbiddenWords();
      await sock.sendMessage(message.key.remoteJid, { text: `Kata terlarang berhasil dihapus: ${words.join(", ")}` });
    }
  } catch (error) {
    console.error("Error in handleForbiddenWordCommand:", error);
  }
};

/**
 * Fungsi untuk memeriksa setiap pesan grup.
 * Jika pesan dari anggota (non-admin) mengandung kata terlarang:
 * - Pesan dihapus.
 * - Peringatan diberikan (3x peringatan).
 * - Pada pelanggaran ke-3, anggota dikeluarkan dari grup.
 * Catatan: Jika pengirim adalah admin, tidak diproses.
 */
const forbiddenWordChecker = async (sock, message) => {
  try {
    const remoteJid = message.key.remoteJid;
    if (!remoteJid.endsWith('@g.us')) return; // hanya untuk grup

    // Hanya aktif di grup yang ID-nya terdaftar pada groupConfig.allowedGroups
    if (!groupConfig.allowedGroups.includes(remoteJid)) return;

    const sender = message.key.participant;
    if (!sender) return;

    // Ambil metadata grup
    const groupMeta = await sock.groupMetadata(remoteJid);
    // Abaikan pesan dari admin
    const isSenderAdmin = groupMeta.participants.some(
      p => p.id === sender && p.admin !== null
    );
    if (isSenderAdmin) return;

    let text = message.message.conversation || message.message.extendedTextMessage?.text || "";
    text = text.toLowerCase();

    // Cek apakah ada kata terlarang di pesan
    let found = false;
    for (let word of forbiddenWords) {
      if (text.includes(word)) {
        found = true;
        break;
      }
    }
    if (!found) return;

    // Hapus pesan
    await sock.sendMessage(remoteJid, { delete: message.key });
    console.log(`Pesan dari ${sender} yang mengandung kata terlarang dihapus.`);

    // Perbarui hitungan peringatan
    if (!warningCounts[remoteJid]) warningCounts[remoteJid] = {};
    if (!warningCounts[remoteJid][sender]) warningCounts[remoteJid][sender] = 0;
    warningCounts[remoteJid][sender]++;

    if (warningCounts[remoteJid][sender] < 3) {
      await sock.sendMessage(remoteJid, {
        text: `@${sender.split("@")[0]}, kamu telah melanggar aturan kata terlarang (${warningCounts[remoteJid][sender]}/3).`,
        mentions: [sender]
      });
    } else {
      await sock.sendMessage(remoteJid, {
        text: `@${sender.split("@")[0]} telah dikeluarkan karena terus melanggar aturan kata terlarang.`,
        mentions: [sender]
      });
      // Langsung coba keluarkan anggota tanpa cek admin bot
      try {
        await sock.groupParticipantsUpdate(remoteJid, [sender], 'remove');
      } catch (error) {
        console.error(`Gagal mengeluarkan ${sender}:`, error);
      }
      warningCounts[remoteJid][sender] = 0;
    }
  } catch (error) {
    console.error("Error in forbiddenWordChecker:", error);
  }
};

module.exports = { handleForbiddenWordCommand, forbiddenWordChecker };
