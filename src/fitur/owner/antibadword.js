const fs = require('fs');
const path = require('path');
const { groupId } = require('../../config');

// Pastikan struktur folder: /src/database/badword/
// Karena file ini berada di /src/fitur/owner/, maka naik 2 level ke /src, lalu ke database/badword
const BADWORD_DIR = path.join(__dirname, '../../database/badword');
const BADWORD_FILE = path.join(BADWORD_DIR, 'badwords.json');

async function ensureBadwordFile() {
  if (!fs.existsSync(BADWORD_DIR)) {
    fs.mkdirSync(BADWORD_DIR, { recursive: true });
  }
  if (!fs.existsSync(BADWORD_FILE)) {
    fs.writeFileSync(BADWORD_FILE, JSON.stringify([]));
  }
}

async function readBadwords() {
  await ensureBadwordFile();
  try {
    const data = fs.readFileSync(BADWORD_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error membaca file badword:', err);
    return [];
  }
}

async function writeBadwords(badwords) {
  await ensureBadwordFile();
  fs.writeFileSync(BADWORD_FILE, JSON.stringify(badwords, null, 2));
}

/**
 * Fungsi handleAntibadword
 * Fitur ini memproses perintah antibadword dari chat pribadi maupun dari grup target.
 *
 * Format perintah:
 * - Tambah:  addbadword | kata1 kata2
 * - Hapus:   deletebadword | kata1 kata2 ... 
 *            Alias: delete | kata1 kata2 ...
 */
async function handleAntibadword(sock) {
  sock.ev.on('messages.upsert', async (event) => {
    for (const message of event.messages) {
      // Abaikan pesan dari bot sendiri atau pesan kosong
      if (message.key.fromMe || !message.message) continue;
      
      const chatId = message.key.remoteJid;
      // Jika pesan berasal dari grup, proses hanya jika chatId sesuai dengan groupId.
      if (chatId.endsWith('@g.us') && chatId !== groupId) continue;
      
      // Validasi admin hanya untuk grup; untuk chat pribadi kita anggap sah.
      let isAdmin = true;
      if (chatId.endsWith('@g.us')) {
        const sender = message.key.participant;
        let metadata;
        try {
          metadata = await sock.groupMetadata(chatId);
        } catch (err) {
          console.error('Gagal mengambil metadata grup:', err);
          continue;
        }
        isAdmin = metadata.participants.some(p =>
          p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')
        );
      }
      if (!isAdmin) continue;
      
      // Ambil teks pesan
      let text = '';
      if (message.message.conversation) {
        text = message.message.conversation;
      } else if (message.message.extendedTextMessage?.text) {
        text = message.message.extendedTextMessage.text;
      }
      text = text.trim();
      const lowerText = text.toLowerCase();
      
      // --- Tambah Badword ---
      if (lowerText.startsWith("addbadword")) {
        // Format: addbadword | kata1 kata2 ...
        const parts = text.split("|");
        if (parts.length < 2) {
          await sock.sendMessage(chatId, { text: 'Format salah. Gunakan:\naddbadword | kata1 kata2 ...' }, { quoted: message });
          continue;
        }
        const wordsInput = parts[1].trim();
        if (!wordsInput) {
          await sock.sendMessage(chatId, { text: 'Tidak ada kata yang diberikan.' }, { quoted: message });
          continue;
        }
        const wordsToAdd = wordsInput.split(" ").map(w => w.toLowerCase());
        let badwords = await readBadwords();
        let addedWords = [];
        for (const word of wordsToAdd) {
          if (!badwords.includes(word)) {
            badwords.push(word);
            addedWords.push(word);
          }
        }
        await writeBadwords(badwords);
        if (addedWords.length > 0) {
          await sock.sendMessage(chatId, { text: `Berhasil menambahkan kata terlarang: ${addedWords.join(", ")}` }, { quoted: message });
        } else {
          await sock.sendMessage(chatId, { text: 'Kata terlarang sudah ada.' }, { quoted: message });
        }
      } 
      // --- Edit Badword ---
      else if (lowerText.startsWith("editbadword")) {
        // Format: editbadword | kataLama kataBaru
        const parts = text.split("|");
        if (parts.length < 2) {
          await sock.sendMessage(chatId, { text: 'Format salah. Gunakan:\neditbadword | kataLama kataBaru' }, { quoted: message });
          continue;
        }
        const wordsInput = parts[1].trim().split(" ");
        if (wordsInput.length !== 2) {
          await sock.sendMessage(chatId, { text: 'Format salah. Harus dua kata: kataLama kataBaru' }, { quoted: message });
          continue;
        }
        const [oldWord, newWord] = wordsInput.map(w => w.toLowerCase());
        let badwords = await readBadwords();
        const index = badwords.indexOf(oldWord);
        if (index === -1) {
          await sock.sendMessage(chatId, { text: `Kata "${oldWord}" tidak ditemukan.` }, { quoted: message });
          continue;
        }
        badwords[index] = newWord;
        await writeBadwords(badwords);
        await sock.sendMessage(chatId, { text: `Berhasil mengganti kata "${oldWord}" dengan "${newWord}".` }, { quoted: message });
      } 
      // --- Hapus Badword ---
      // Mendukung perintah "deletebadword" atau alias "delete |"
      else if (lowerText.startsWith("deletebadword") || (lowerText.startsWith("delete") && lowerText.includes("|"))) {
        // Format: deletebadword | kata1 kata2 ...
        const parts = text.split("|");
        if (parts.length < 2) {
          await sock.sendMessage(chatId, { text: 'Format salah. Gunakan:\ndeletebadword | kata1 kata2 ...' }, { quoted: message });
          continue;
        }
        const wordsInput = parts[1].trim();
        if (!wordsInput) {
          await sock.sendMessage(chatId, { text: 'Tidak ada kata yang diberikan untuk dihapus.' }, { quoted: message });
          continue;
        }
        const wordsToDelete = wordsInput.split(" ").map(w => w.toLowerCase());
        let badwords = await readBadwords();
        let deletedWords = [];
        badwords = badwords.filter(word => {
          if (wordsToDelete.includes(word)) {
            deletedWords.push(word);
            return false;
          }
          return true;
        });
        await writeBadwords(badwords);
        if (deletedWords.length > 0) {
          await sock.sendMessage(chatId, { text: `Berhasil menghapus kata terlarang: ${deletedWords.join(", ")}` }, { quoted: message });
        } else {
          await sock.sendMessage(chatId, { text: 'Tidak ditemukan kata terlarang yang cocok untuk dihapus.' }, { quoted: message });
        }
      }
    }
  });
}

module.exports = { handleAntibadword };
