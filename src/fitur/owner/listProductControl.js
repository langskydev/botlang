const fs = require('fs');
const path = require('path');
const { groupId } = require('../../config');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const dataFilePath = path.join(__dirname, '../../../database/listproduct/data.json');

async function readProductData() {
  try {
    if (!fs.existsSync(dataFilePath)) {
      await fs.promises.mkdir(path.dirname(dataFilePath), { recursive: true });
      await fs.promises.writeFile(dataFilePath, JSON.stringify({}), 'utf8');
      return {};
    }
    const data = await fs.promises.readFile(dataFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

async function writeProductData(data) {
  try {
    await fs.promises.writeFile(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    // Error diabaikan agar output console tetap minimal
  }
}

async function downloadImage(message, productName) {
  try {
    const imgDir = path.join(__dirname, '../../../database/img');
    if (!fs.existsSync(imgDir)) {
      fs.mkdirSync(imgDir, { recursive: true });
    }
    // Sanitasi nama produk agar aman dijadikan nama file
    const sanitizedProductName = productName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = sanitizedProductName + '.jpg';
    const fullImagePath = path.join(imgDir, filename);

    // Unduh konten gambar dari message.imageMessage
    const stream = await downloadContentFromMessage(message.message.imageMessage, 'image');
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    fs.writeFileSync(fullImagePath, buffer);
    return fullImagePath;
  } catch (err) {
    return null;
  }
}

async function handleListProductControl(sock) {
  sock.ev.on('messages.upsert', async (event) => {
    try {
      for (const message of event.messages) {
        if (message.key.fromMe) continue;
        const sender = message.key.remoteJid;
        // Proses hanya pada chat pribadi
        if (sender.endsWith('@g.us')) continue;

        // Ambil teks perintah dari berbagai properti pesan
        let text = '';
        if (message.message.conversation) {
          text = message.message.conversation;
        } else if (message.message.extendedTextMessage?.text) {
          text = message.message.extendedTextMessage.text;
        } else if (message.message.imageMessage?.caption) {
          text = message.message.imageMessage.caption;
        }
        if (!text) continue;
        text = text.trim();

        // Pisahkan perintah berdasarkan "|" (contoh: add|namaProduk|harga)
        const parts = text.split('|');
        if (parts.length < 2) continue;
        const command = parts[0].toLowerCase();

        // Verifikasi admin: cek apakah pengirim adalah admin di grup yang dikonfigurasi
        const metadata = await sock.groupMetadata(groupId);
        const isAdmin = metadata.participants.some(p =>
          p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')
        );
        if (!isAdmin) {
          await sock.sendMessage(sender, { text: 'Anda tidak memiliki izin untuk mengubah daftar produk.' });
          continue;
        }

        // Perintah ADD: add|namaProduk|harga
        if (command === 'add') {
          if (parts.length < 3) {
            await sock.sendMessage(sender, { text: 'Format tidak valid. Gunakan: add|namaProduk|harga' });
            continue;
          }
          const productName = parts[1].trim();
          const price = parts[2].trim();
          if (!productName || !price) {
            await sock.sendMessage(sender, { text: 'Nama produk dan harga harus diisi.' });
            continue;
          }
          let imagePath = null;
          // Jika pesan menyertakan gambar, unduh dan simpan
          if (message.message.imageMessage) {
            imagePath = await downloadImage(message, productName);
          }
          const productData = await readProductData();
          productData[productName.toLowerCase()] = { price, image: imagePath };
          await writeProductData(productData);
          await sock.sendMessage(sender, { text: `Produk "${productName}" dengan harga "${price}" berhasil ditambahkan.` });
        }
        // Perintah EDIT: edit|namaProduk|harga
        else if (command === 'edit') {
          if (parts.length < 3) {
            await sock.sendMessage(sender, { text: 'Format tidak valid. Gunakan: edit|namaProduk|harga' });
            continue;
          }
          const productName = parts[1].trim();
          const newPrice = parts[2].trim();
          if (!productName || !newPrice) {
            await sock.sendMessage(sender, { text: 'Nama produk dan harga baru harus diisi.' });
            continue;
          }
          const productData = await readProductData();
          if (!productData.hasOwnProperty(productName.toLowerCase())) {
            await sock.sendMessage(sender, { text: `Produk "${productName}" tidak ditemukan.` });
            continue;
          }
          // Jika ada gambar yang dikirim bersama perintah edit, perbarui gambar juga
          if (message.message.imageMessage) {
            const imagePath = await downloadImage(message, productName);
            productData[productName.toLowerCase()] = { price: newPrice, image: imagePath };
          } else {
            productData[productName.toLowerCase()].price = newPrice;
          }
          await writeProductData(productData);
          await sock.sendMessage(sender, { text: `Produk "${productName}" berhasil diupdate dengan harga "${newPrice}".` });
        }
        // Perintah DELETE: delete|namaProduk
        else if (command === 'delete') {
          if (parts.length < 2) {
            await sock.sendMessage(sender, { text: 'Format tidak valid. Gunakan: delete|namaProduk' });
            continue;
          }
          const productName = parts[1].trim();
          if (!productName) {
            await sock.sendMessage(sender, { text: 'Nama produk harus diisi.' });
            continue;
          }
          const productData = await readProductData();
          if (!productData.hasOwnProperty(productName.toLowerCase())) {
            await sock.sendMessage(sender, { text: `Produk "${productName}" tidak ditemukan.` });
            continue;
          }
          // Hapus file gambar jika ada
          if (productData[productName.toLowerCase()].image) {
            const imgPath = productData[productName.toLowerCase()].image;
            if (fs.existsSync(imgPath)) {
              fs.unlinkSync(imgPath);
            }
          }
          delete productData[productName.toLowerCase()];
          await writeProductData(productData);
          await sock.sendMessage(sender, { text: `Produk "${productName}" berhasil dihapus.` });
        }
      }
    } catch (err) {
      // Abaikan error untuk output minimal
    }
  });
}

module.exports = { handleListProductControl };
