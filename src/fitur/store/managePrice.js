const fs = require('fs');
const path = require('path');
const groupConfig = require('../../groupConfig');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function handlePriceCommand(sock, message) {
  // Ambil teks perintah dari pesan teks atau caption gambar
  const msgText =
    message.message.conversation ||
    message.message.extendedTextMessage?.text ||
    message.message.imageMessage?.caption ||
    "";
    
  const remoteJid = message.key.remoteJid;
  const parts = msgText.split("|").map((part) => part.trim());
  const command = parts[0].toLowerCase();

  // Tentukan sender ID: jika dari grup, gunakan message.key.participant; jika pribadi, gunakan remoteJid
  const senderId = remoteJid.endsWith("@g.us")
    ? message.key.participant
    : remoteJid;

  // Untuk perintah add, edit, delete, cek apakah sender adalah admin salah satu grup yang diizinkan
  if (["add", "edit", "delete"].includes(command)) {
    let isAdmin = false;
    for (const groupJid of groupConfig.allowedGroups) {
      try {
        const groupMeta = await sock.groupMetadata(groupJid);
        const adminIds = groupMeta.participants
          .filter((p) => p.admin !== null)
          .map((p) => p.id);
        if (adminIds.includes(senderId)) {
          isAdmin = true;
          break;
        }
      } catch (err) {
        console.error(`Error checking admin for group ${groupJid}:`, err);
      }
    }
    if (!isAdmin) {
      await sock.sendMessage(remoteJid, {
        text: "Maaf, hanya admin grup yang dapat menjalankan perintah ini.",
      });
      return;
    }
  }

  // Direktori untuk menyimpan data harga dan gambar
  const baseDir = path.join(__dirname, "../../../database");
  const imageBaseDir = path.join(__dirname, "../../../assets/gambar");

  switch (command) {
    case "add": {
      // Format perintah: add|namaProduct|harga
      if (parts.length < 3) {
        await sock.sendMessage(remoteJid, {
          text: "Format salah. Gunakan: add|namaProduct|harga",
        });
        return;
      }
      const productName = parts[1].toLowerCase();
      const productPrice = parts[2];

      // Simpan data harga di folder database
      const productDir = path.join(baseDir, productName);
      if (!fs.existsSync(productDir)) {
        fs.mkdirSync(productDir, { recursive: true });
      }
      const filePath = path.join(productDir, "price.json");
      fs.writeFileSync(filePath, JSON.stringify({ price: productPrice }), "utf8");

      // Jika pesan mengandung gambar (bisa dengan atau tanpa gambar)
      if (message.message.imageMessage) {
        try {
          // Gunakan downloadContentFromMessage untuk mengambil stream gambar
          const stream = await downloadContentFromMessage(message.message.imageMessage, 'image');
          let buffer = Buffer.from([]);
          for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
          }
          // Simpan buffer gambar ke folder assets/gambar/<namaProduct>
          const assetsDir = path.join(imageBaseDir, productName);
          if (!fs.existsSync(assetsDir)) {
            fs.mkdirSync(assetsDir, { recursive: true });
          }
          // Tentukan ekstensi file berdasarkan mimetype (default .jpg)
          let extension = ".jpg";
          const mime = message.message.imageMessage.mimetype;
          if (mime) {
            const mimeParts = mime.split("/");
            if (mimeParts.length === 2) {
              extension = "." + mimeParts[1];
            }
          }
          const imagePath = path.join(assetsDir, productName + extension);
          fs.writeFileSync(imagePath, buffer);
          await sock.sendMessage(remoteJid, {
            text: `Produk ${productName} dengan gambar berhasil ditambahkan dengan harga ${productPrice}`,
          });
        } catch (err) {
          console.error("Error downloading image:", err);
          await sock.sendMessage(remoteJid, {
            text: "Gagal menyimpan gambar. Pastikan gambar sudah dikirim dengan benar.",
          });
          return;
        }
      } else {
        // Jika tidak ada gambar, hanya simpan data harga
        await sock.sendMessage(remoteJid, {
          text: `Produk ${productName} berhasil ditambahkan dengan harga ${productPrice}`,
        });
      }
      break;
    }
    case "edit": {
      // Format: edit|namaProduct|hargaBaru
      if (parts.length < 3) {
        await sock.sendMessage(remoteJid, {
          text: "Format salah. Gunakan: edit|namaProduct|hargaBaru",
        });
        return;
      }
      const productName = parts[1].toLowerCase();
      const newPrice = parts[2];
      const productDir = path.join(baseDir, productName);
      const filePath = path.join(productDir, "price.json");
      if (!fs.existsSync(filePath)) {
        await sock.sendMessage(remoteJid, {
          text: `Produk ${productName} tidak ditemukan. Gunakan perintah add untuk menambahkannya.`,
        });
        return;
      }
      fs.writeFileSync(filePath, JSON.stringify({ price: newPrice }), "utf8");
      await sock.sendMessage(remoteJid, {
        text: `Harga untuk ${productName} berhasil diubah menjadi ${newPrice}`,
      });
      break;
    }
    case "delete": {
      // Format: delete|namaProduct
      if (parts.length < 2) {
        await sock.sendMessage(remoteJid, {
          text: "Format salah. Gunakan: delete|namaProduct",
        });
        return;
      }
      const productName = parts[1].toLowerCase();
      const productDir = path.join(baseDir, productName);
      if (!fs.existsSync(productDir)) {
        await sock.sendMessage(remoteJid, {
          text: `Produk ${productName} tidak ditemukan.`,
        });
        return;
      }
      fs.rmSync(productDir, { recursive: true, force: true });
      // Hapus folder gambar jika ada
      const imageDir = path.join(imageBaseDir, productName);
      if (fs.existsSync(imageDir)) {
        fs.rmSync(imageDir, { recursive: true, force: true });
      }
      await sock.sendMessage(remoteJid, {
        text: `Produk ${productName} berhasil dihapus.`,
      });
      break;
    }
    default: {
      // Query: asumsikan pesan merupakan nama produk
      const productName = msgText.toLowerCase();
      const productDir = path.join(baseDir, productName);
      const filePath = path.join(productDir, "price.json");
      if (fs.existsSync(filePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
          const imageDir = path.join(imageBaseDir, productName);
          if (fs.existsSync(imageDir)) {
            // Cari file gambar (misal: jpg, jpeg, png)
            const imageFiles = fs
              .readdirSync(imageDir)
              .filter((file) => /\.(jpg|jpeg|png)$/i.test(file));
            if (imageFiles.length > 0) {
              const imagePath = path.join(imageDir, imageFiles[0]);
              await sock.sendMessage(remoteJid, {
                image: { url: imagePath },
                caption: `Harga: ${data.price}`,
              });
              return;
            }
          }
          await sock.sendMessage(remoteJid, { text: `Harga: ${data.price}` });
        } catch (error) {
          console.error("Error reading product data:", error);
          await sock.sendMessage(remoteJid, {
            text: "Terjadi kesalahan membaca data produk.",
          });
        }
      }
      break;
    }
  }
}

module.exports = { handlePriceCommand };
