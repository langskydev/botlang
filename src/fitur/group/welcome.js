const { groupId } = require('../../config');
const state = require('../../state');

async function handleWelcome(sock) {
  sock.ev.on('group-participants.update', async (update) => {
    try {
      // Jika fitur welcome nonaktif, langsung hentikan proses
      if (!state.welcomeEnabled) return;

      // Proses hanya untuk grup yang dikonfigurasi dan aksi penambahan anggota
      if (update.id === groupId && update.action === 'add' && update.participants) {
        const metadata = await sock.groupMetadata(update.id);
        const groupName = metadata.subject;
        for (let participant of update.participants) {
          const welcomeMessage = 
`🎉 Selamat Datang di ${groupName}! 🎉

Hai, @${participant.split('@')[0]}! 👋 Senang kamu bergabung di sini. Untuk melihat daftar harga dan aplikasi yang tersedia, ketik “list”.

Jika ada pertanyaan, jangan ragu untuk bertanya. Selamat berbelanja! 🚀`;
          await sock.sendMessage(update.id, { text: welcomeMessage, mentions: [participant] });
        }
      }
    } catch (err) {
      // Tidak menampilkan log error agar output console tetap minimal
    }
  });
}

module.exports = { handleWelcome };
