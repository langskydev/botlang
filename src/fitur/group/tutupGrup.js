// /src/fitur/group/tutupGrup.js
const tutupGrup = async (sock, message) => {
  try {
    const remoteJid = message.key.remoteJid;
    // Pastikan hanya diproses jika pesan berasal dari grup
    if (!remoteJid.endsWith('@g.us')) return;
    
    // Ambil teks pesan
    let text = message.message.conversation || message.message.extendedTextMessage?.text || "";
    text = text.trim().toLowerCase();
    if (text !== "cl") return; // Proses hanya jika pesan adalah "cl"
    
    // Ambil metadata grup dan cek apakah pengirim adalah admin
    const groupMeta = await sock.groupMetadata(remoteJid);
    const sender = message.key.participant;
    if (!sender) return;
    
    const isAdmin = groupMeta.participants.some(p => p.id === sender && p.admin !== null);
    if (!isAdmin) {
      await sock.sendMessage(remoteJid, { text: "Maaf, hanya admin yang dapat menutup grup." });
      return;
    }
    
    // Ubah setting grup menjadi announcement (hanya admin yang dapat mengirim pesan)
    await sock.groupSettingUpdate(remoteJid, "announcement");
    
    // Dapatkan tanggal dan waktu saat ini dengan format WIB
    const now = new Date();
    const date = now.toLocaleDateString("id-ID", { 
      day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" 
    });
    const time = now.toLocaleTimeString("id-ID", { 
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" 
    });
    
    // Format pesan penutupan grup
    const messageText = `╭─❒ 「 🔒 𝗚𝗥𝗨𝗣 𝗗𝗜𝗧𝑼𝗧𝑼𝗣 」  
│ 📆 𝑇𝑎𝑛𝑔𝑔𝑎𝑙: ${date}
│ ⏰ 𝑊𝑎𝑘𝑡𝑢: ${time} WIB  
│ 🌐 𝑆𝑡𝑎𝑡𝑢𝑠: 𝐎𝐟𝐟𝐥𝐢𝐧𝐞  
│ 🛒 𝑇𝑟𝑎𝑛𝑠𝑎𝑘𝑠𝑖: 𝐕𝐢𝐚 𝐀𝐝𝐦𝐢𝐧  
╰───────────────❍  

📌 Terima kasih atas kepercayaan kalian!  
Untuk pemesanan atau pertanyaan, hubungi admin.  
Pastikan semua transaksi hanya melalui admin resmi ✅`;
    
    // Kirim pesan penutupan
    await sock.sendMessage(remoteJid, { text: messageText });
    
  } catch (error) {
    console.error("Error in tutupGrup:", error);
  }
};

module.exports = { tutupGrup };
