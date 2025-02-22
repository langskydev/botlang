const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const hidetag = async (sock, message) => {
  try {
    // Ambil teks pesan dari conversation atau extendedTextMessage
    let text =
      message.message.conversation ||
      message.message.extendedTextMessage?.text ||
      "";
    text = text.trim();

    const isReply =
      message.message.extendedTextMessage?.contextInfo?.quotedMessage !== undefined;

    // Jika bukan reply, pastikan pesan diawali "h " atau ".h "
    if (!isReply && !(text.startsWith("h ") || text.startsWith(".h "))) {
      return;
    }

    let messageToSend = "";
    let mediaMessage = null;
    let mediaType = null;

    if (isReply) {
      const quoted =
        message.message.extendedTextMessage.contextInfo.quotedMessage;

      if (text === "h" || text === ".h") {
        if (quoted.conversation) {
          messageToSend = quoted.conversation;
        } else if (quoted.extendedTextMessage?.text) {
          messageToSend = quoted.extendedTextMessage.text;
        }
      } else {
        if (text.startsWith("h ")) {
          messageToSend = text.substring(2).trim();
        } else if (text.startsWith(".h ")) {
          messageToSend = text.substring(3).trim();
        }
      }

      // Cek jika pesan yang dibalas adalah gambar
      if (quoted.imageMessage) {
        mediaMessage = quoted.imageMessage;
        mediaType = "image";
      }
    } else {
      if (text.startsWith("h ")) {
        messageToSend = text.substring(2).trim();
      } else if (text.startsWith(".h ")) {
        messageToSend = text.substring(3).trim();
      }

      // Cek jika pesan mengandung gambar
      if (message.message.imageMessage) {
        mediaMessage = message.message.imageMessage;
        mediaType = "image";
      }
    }

    if (!messageToSend && !mediaMessage) return;

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

    if (mediaMessage) {
      // Download gambar menggunakan @whiskeysockets/baileys
      const stream = await downloadContentFromMessage(mediaMessage, "image");
      let buffer = Buffer.from([]);

      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      // Kirim ulang gambar dengan caption dan mention
      await sock.sendMessage(remoteJid, {
        image: buffer,
        caption: messageToSend,
        mentions: allParticipants,
      });
    } else {
      // Jika tidak ada media, hanya kirim teks
      await sock.sendMessage(remoteJid, {
        text: messageToSend,
        mentions: allParticipants,
      });
    }
  } catch (error) {
    console.error("Error in hidetag feature:", error);
  }
};

module.exports = { hidetag };
