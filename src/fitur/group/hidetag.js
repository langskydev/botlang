const hidetag = async (sock, message) => {
  try {
    // Ambil teks pesan dari conversation atau extendedTextMessage
    let text =
      message.message.conversation ||
      message.message.extendedTextMessage?.text ||
      "";
    text = text.trim();

    // Pastikan perintah dimulai dengan "h" atau ".h"
    const isReply =
      message.message.extendedTextMessage?.contextInfo?.quotedMessage !== undefined;
    
    // Jika bukan reply, pastikan pesan diawali "h " atau ".h "
    if (!isReply && !(text.startsWith("h ") || text.startsWith(".h "))) {
      return;
    }

    // Variabel untuk pesan yang akan dikirim ulang
    let messageToSend = "";

    if (isReply) {
      // Jika reply, periksa apakah teks hanya "h" atau ".h" (tanpa tambahan)
      if (text === "h" || text === ".h") {
        // Ambil pesan yang dibalas
        const quoted =
          message.message.extendedTextMessage.contextInfo.quotedMessage;
        if (quoted.conversation) {
          messageToSend = quoted.conversation;
        } else if (quoted.extendedTextMessage?.text) {
          messageToSend = quoted.extendedTextMessage.text;
        }
      } else {
        // Jika reply tapi ada tambahan teks, gunakan teks setelah prefix
        if (text.startsWith("h ")) {
          messageToSend = text.substring(2).trim();
        } else if (text.startsWith(".h ")) {
          messageToSend = text.substring(3).trim();
        }
      }
    } else {
      // Bukan reply, ambil pesan setelah prefix "h " atau ".h "
      if (text.startsWith("h ")) {
        messageToSend = text.substring(2).trim();
      } else if (text.startsWith(".h ")) {
        messageToSend = text.substring(3).trim();
      }
    }

    if (!messageToSend) return; // Jika tidak ada isi pesan, tidak melakukan apa-apa

    // Pastikan pesan berada di grup
    const remoteJid = message.key.remoteJid;
    if (!remoteJid.endsWith("@g.us")) return;

    // Ambil metadata grup dan periksa admin
    const groupMeta = await sock.groupMetadata(remoteJid);
    const senderId = message.key.participant;
    const isAdmin = groupMeta.participants.some(
      (participant) => participant.id === senderId && participant.admin !== null
    );
    if (!isAdmin) {
      await sock.sendMessage(remoteJid, {
        text: "Hanya admin grup yang dapat menggunakan fitur hidetag.",
      });
      return;
    }

    // Ambil ID semua peserta untuk di-mention
    const allParticipants = groupMeta.participants.map((p) => p.id);

    // Kirim pesan dengan mention ke semua anggota grup
    await sock.sendMessage(remoteJid, {
      text: messageToSend,
      mentions: allParticipants,
    });
  } catch (error) {
    console.error("Error in hidetag feature:", error);
  }
};

module.exports = { hidetag };
