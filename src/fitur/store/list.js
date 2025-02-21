const moment = require('moment');

async function handleMessage(sock, message) {
    const msgText = message.message.conversation || message.message.extendedTextMessage?.text || "";
    const remoteJid = message.key.remoteJid;
    
    if (msgText.toLowerCase() === "list") {
        // Tentukan salam berdasarkan waktu
        const now = moment().locale('id');
        const currentHour = now.hour();
        let greeting = 'Selamat pagi';
        if (currentHour >= 12 && currentHour < 15) {
            greeting = 'Selamat siang';
        } else if (currentHour >= 15 && currentHour < 18) {
            greeting = 'Selamat sore';
        } else if (currentHour >= 18 || currentHour < 5) {
            greeting = 'Selamat malam';
        }
        
        // Gunakan nama pengirim (default "Kawan" jika tidak tersedia)
        const senderName = message.pushName || "Kawan";

        // Dapatkan nama grup (jika memungkinkan)
        let groupName = remoteJid;
        try {
            const groupMeta = await sock.groupMetadata(remoteJid);
            groupName = groupMeta.subject;
        } catch (error) {
            console.error("Error fetching group metadata: ", error);
        }

        const response = `
┌──⭓「 LIST PRODUK ✓⃝ 」
│ ${greeting} ${senderName}
│1. 🛍 PAYMENT
│2. 🛍 YOUTUBE
│3. 🛍 VIU
│4. 🛍 CANVA
│5. 🛍 PRIME VIDEO
│6. 🛍 APPLE MUSIC
│7. 🛍 VIDIO
│8. 🛍 NETFLIX
│9. 🛍 CAPCUT
│10. 🛍 ALIGHT MOTION
│11. 🛍 ZOOM
│13. 🛍 VISION
│14. 🛍 BSTATION
│15. 🛍 WETV
│16. 🛍 IQIYI
│27. 🛍 DISNEY
│18. 🛍 PENJELASAN NETFLIX
│19. 🛍 GDRIVE
│20. 🛍 GTC
│21. 🛍 RCTI
│22. 🛍 CARA ORDER
│23. 🛍 CHATGPT
│25. 🛍 PROMO
│26. 🛍 SPOTIFY
│
└────────────⭓
GRUP : ${groupName}
JAM : ⏰ ${now.format('HH:mm')}
TANGGAL : 📆 ${now.format('DD/MM/YYYY')}

NOTE : 
Untuk melihat produk berdasarkan nomor, atau ketik nama produk yang ada pada list di atas.
        `;
        await sock.sendMessage(remoteJid, { text: response });
    }
}

module.exports = { handleMessage };
