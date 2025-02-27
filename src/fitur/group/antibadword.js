const fs = require('fs');
const path = require('path');
const { groupId } = require('../../config');

// Lokasi file badword (pastikan file ini sama dengan yang digunakan di fitur owner)
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

// Objek untuk menyimpan jumlah pelanggaran per member secara in-memory
const badwordCounts = {};

/**
 * Fungsi handleAntibadwordGroup
 * Memantau pesan pada grup target, menghapus pesan yang mengandung badword,
 * serta melakukan kick apabila pelanggaran sudah mencapai 3 kali.
 */
function handleAntibadwordGroup(sock) {
  sock.ev.on('messages.upsert', async (event) => {
    for (const message of event.messages) {
      // Lewati pesan dari bot sendiri atau pesan tanpa isi
      if (message.key.fromMe || !message.message) continue;
      
      const chatId = message.key.remoteJid;
      // Proses hanya jika pesan berasal dari grup target
      if (chatId !== groupId) continue;
      
      // Ambil teks pesan
      let text = '';
      if (message.message.conversation) {
        text = message.message.conversation;
      } else if (message.message.extendedTextMessage?.text) {
        text = message.message.extendedTextMessage.text;
      }
      text = text.trim();
      if (!text) continue;
      
      // Ambil daftar badword
      const badwords = await readBadwords();
      if (!badwords.length) continue; // jika belum ada badword, abaikan
      
      // Cek apakah teks mengandung salah satu badword (case-insensitive)
      const lowerText = text.toLowerCase();
      const foundBadword = badwords.find(word => lowerText.includes(word));
      
      if (foundBadword) {
        // Hapus pesan yang mengandung badword
        try {
          await sock.sendMessage(chatId, { delete: message.key });
        } catch (err) {
          console.error('Gagal menghapus pesan:', err);
        }
        
        // Identifikasi pengirim
        const sender = message.key.participant || message.key.remoteJid;
        if (!badwordCounts[sender]) {
          badwordCounts[sender] = 0;
        }
        badwordCounts[sender]++;
        
        // Kirim pesan peringatan dengan gaya keren
        const warningMessage = `⚠️ @${sender.split('@')[0]}, jaga kata-katamu! Kata terlarang terdeteksi (${badwordCounts[sender]}/3).`;
        await sock.sendMessage(chatId, { text: warningMessage, mentions: [sender] }, { quoted: message });
        
        // Jika sudah mencapai 3 pelanggaran, kick member tersebut
        if (badwordCounts[sender] >= 3) {
          const kickMessage = `🚫 @${sender.split('@')[0]} telah mencapai 3 pelanggaran dan akan dikick. Jaga perilaku, ya!`;
          await sock.sendMessage(chatId, { text: kickMessage, mentions: [sender] });
          try {
            await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
          } catch (err) {
            console.error('Gagal melakukan kick:', err);
          }
          // Reset hitungan pelanggaran untuk member tersebut
          badwordCounts[sender] = 0;
        }
      }
    }
  });
}

module.exports = { handleAntibadwordGroup };
