function handlePendingMessage(sock, m) {
  // Ambil teks pesan (baik dari conversation atau extendedTextMessage)
  let text = '';
  if (m.message.conversation) {
    text = m.message.conversation;
  } else if (m.message.extendedTextMessage && m.message.extendedTextMessage.text) {
    text = m.message.extendedTextMessage.text;
  }

  // Pastikan pesan merupakan reply (ada contextInfo dan participant)
  const contextInfo = m.message.extendedTextMessage && m.message.extendedTextMessage.contextInfo;
  if (!contextInfo || !contextInfo.participant) return;

  // Cegah jika admin membalas pesan miliknya sendiri
  const sender = m.key.participant || m.key.remoteJid;
  if (contextInfo.participant === sender) return;

  // Ambil tanggal dan waktu sesuai zona WIB (Asia/Jakarta)
  const tanggal = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' });
  const waktu = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });

  // Dapatkan ID pembeli dari contextInfo (user yang direply oleh admin)
  const buyerId = contextInfo.participant;

  // Ambil nama WhatsApp pembeli
  let buyerName = 'Tidak Diketahui';
  if (sock.contacts && sock.contacts[buyerId]) {
    buyerName =
      sock.contacts[buyerId].notify ||
      sock.contacts[buyerId].vname ||
      sock.contacts[buyerId].name ||
      'Tidak Diketahui';
  }

  // Jika pesan yang dikirim adalah "p", kirim pesan pending
  if (text.trim().toLowerCase() === 'p') {
    const pendingMessage = 
`╭─❒ 「 ⏳ 𝗣𝗘𝗡𝗗𝗜𝗡𝗚 」  
│ 📆 𝑇𝑎𝑛𝑔𝑔𝑎𝑙: ${tanggal}  
│ ⏰ 𝑊𝑎𝑘𝑡𝑢: ${waktu} WIB  
│ 🚫 𝑆𝑡𝑎𝑡𝑢𝑠: *Pending*
│ 👤 𝑃𝑒𝑚𝑏𝑒𝑙𝑖: @${buyerId.replace(/@s\.whatsapp\.net$/, '')}
│ 📩 𝑅𝑒𝑠𝑝𝑜𝑛: 𝐀𝐤𝐚𝐧 𝐝𝐢𝐩𝐫𝑜𝑠𝐞𝑠 𝐬𝐞𝐠𝐞𝐫𝐚  
╰───────────────❍  

📢 Harap bersabar!
Saat ini pesan dalam antrian dan akan segera diproses. Mohon tunggu dan jangan spam untuk mempercepat respons ✅`;

    sock.sendMessage(m.key.remoteJid, { text: pendingMessage, mentions: [buyerId] }, { quoted: m });
  }

  // Jika pesan yang dikirim adalah "d", kirim pesan berhasil
  if (text.trim().toLowerCase() === 'd') {
    const successMessage = 
`╭─❒ 「 ✅ 𝗕𝗘𝗥𝗛𝗔𝗦𝗜𝗟 」  
│ 📆 𝑇𝑎𝑛𝑔𝑔𝑎𝑙: ${tanggal}  
│ ⏰ 𝑊𝑎𝑘𝑡𝑢: ${waktu} WIB   
│ 📦 𝑆𝑡𝑎𝑡𝑢𝑠: *𝐃𝐎𝐍𝐄*  
╰───────────────❍  

🎉 Terima kasih, @${buyerId.replace(/@s\.whatsapp\.net$/, '')}!  
Pesananmu telah berhasil diproses. Jika ada kendala, silakan hubungi admin. Jangan lupa order lagi! ✅`;

    sock.sendMessage(m.key.remoteJid, { text: successMessage, mentions: [buyerId] }, { quoted: m });
  }
}

module.exports = { handlePendingMessage };
