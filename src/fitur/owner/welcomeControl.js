const { groupId } = require("../../config");
const state = require("../../state");

async function handleWelcomeControl(sock) {
  sock.ev.on("messages.upsert", async (event) => {
    try {
      for (const message of event.messages) {
        // Abaikan pesan yang dikirim oleh bot
        if (message.key.fromMe) continue;
        // Proses hanya untuk chat pribadi (bukan grup)
        const sender = message.key.remoteJid;
        if (sender.endsWith("@g.us")) continue;

        let text = "";
        if (message.message.conversation) {
          text = message.message.conversation;
        } else if (message.message.extendedTextMessage?.text) {
          text = message.message.extendedTextMessage.text;
        }
        if (!text) continue;
        text = text.trim().toLowerCase();

        if (text === "welcomeof" || text === "welcomeon") {
          // Ambil metadata grup untuk mendapatkan daftar admin
          const metadata = await sock.groupMetadata(groupId);
          // Cek apakah pengirim adalah admin (admin atau superadmin)
          const isAdmin = metadata.participants.some(
            (p) =>
              p.id === sender &&
              (p.admin === "admin" || p.admin === "superadmin")
          );
          if (!isAdmin) {
            await sock.sendMessage(sender, {
              text: "Anda tidak memiliki izin untuk mengubah status welcome.",
            });
            continue;
          }

          if (text === "welcomeof") {
            state.welcomeEnabled = false;
            await sock.sendMessage(sender, {
              text: "Fitur welcome telah dinonaktifkan.",
            });
          } else if (text === "welcomeon") {
            state.welcomeEnabled = true;
            await sock.sendMessage(sender, {
              text: "Fitur welcome telah diaktifkan.",
            });
          }
        }
      }
    } catch (err) {
      console.log("Errror handle welcome message", err);
    }
  });
}

module.exports = { handleWelcomeControl };
