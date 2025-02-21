// /src/fitur/group/bukaGrup.js
const bukaGrup = async (sock, message) => {
  try {
    const remoteJid = message.key.remoteJid;
    // Pastikan hanya diproses jika pesan berasal dari grup
    if (!remoteJid.endsWith('@g.us')) return;

    // Ambil teks pesan dan periksa apakah pesan adalah "op"
    let text = message.message.conversation || message.message.extendedTextMessage?.text || "";
    text = text.trim().toLowerCase();
    if (text !== "op") return;

    // Ambil metadata grup dan pastikan pengirim adalah admin
    const groupMeta = await sock.groupMetadata(remoteJid);
    const sender = message.key.participant;
    if (!sender) return;
    const isAdmin = groupMeta.participants.some(
      (p) => p.id === sender && p.admin !== null
    );
    if (!isAdmin) {
      await sock.sendMessage(remoteJid, { text: "Maaf, hanya admin yang dapat membuka grup." });
      return;
    }

    // Ubah setting grup menjadi diskusi (tidak announcement)
    await sock.groupSettingUpdate(remoteJid, "not_announcement");

    // Dapatkan tanggal dan waktu saat ini dalam format Indonesia (WIB)
    const now = new Date();
    const date = now.toLocaleDateString("id-ID", { 
      day: "numeric", month: "numeric", year: "numeric", timeZone: "Asia/Jakarta" 
    });
    let time = now.toLocaleTimeString("id-ID", { 
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" 
    });
    // Ganti tanda titik dua (:) menjadi titik (.) agar sesuai format contoh
    time = time.replace(":", ".");

    // Format pesan pembukaan grup
    const messageText = `╭─❒ 「 🔓 𝗚𝗥𝗨𝗣 𝗞𝗘𝗠𝗕𝗔𝗟𝗜 𝗗𝗜𝗕𝗨𝗞𝗔 」  
│ 📆 𝑇𝑎𝑛𝑔𝑔𝑎𝑙: ${date}  
│ ⏰ 𝑊𝑎𝑘𝑡𝑢: ${time} WIB  
│ 🌐 𝑆𝑡𝑎𝑡𝑢𝑠: 𝐎𝐧𝐥𝐢𝐧𝐞  
│ 🛒 𝑇𝑟𝑎𝑛𝑠𝑎𝑘𝑠𝑖: 𝐀𝐤𝐭𝐢𝐟  
╰───────────────❍  

📢 Selamat datang kembali!
Grup telah dibuka kembali. Silakan berdiskusi dan bertransaksi seperti biasa. Pastikan selalu transaksi hanya melalui admin resmi ✅`;

    // Kirim pesan pembukaan grup
    await sock.sendMessage(remoteJid, { text: messageText });
  } catch (error) {
    console.error("Error in bukaGrup:", error);
  }
};

module.exports = { bukaGrup };
