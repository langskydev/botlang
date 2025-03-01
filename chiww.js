const chalk = require('chalk');
const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeInMemoryStore,
  proto,
  prepareWAMessageMedia,
  generateWAMessageFromContent,
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");
const fs = require('fs');
const path = require('path');
const levenshtein = require('fast-levenshtein');

// Fungsi bantu untuk mendownload media menggunakan downloadContentFromMessage
async function downloadMedia(chiwa, m) {
  try {
    let messageContent;
    let mime = "";
    if (m.message?.imageMessage) {
      messageContent = m.message.imageMessage;
      mime = messageContent.mimetype;
    } else if (m.message?.videoMessage) {
      messageContent = m.message.videoMessage;
      mime = messageContent.mimetype;
    } else {
      return null;
    }
    const type = mime.split("/")[0]; // misal "image" atau "video"
    const stream = await downloadContentFromMessage(messageContent, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
  } catch (err) {
    console.error("Download media error:", err);
    return null;
  }
}

module.exports = chiwa = async (chiwa, m, chatUpdate, messages, store) => {
  const isOwner = m.sender.startsWith(process.env.OWNER_NUMBER);
  const isRegistered = true;
  const prefix = process.env.PREFIX;

  var body = m?.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson
    ? JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson).id
    : m?.message?.conversation ||
    m?.message?.imageMessage?.caption ||
    m?.message?.videoMessage?.caption ||
    m?.message?.extendedTextMessage?.text ||
    m?.message?.buttonsResponseMessage?.selectedButtonId ||
    m?.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m?.message?.templateButtonReplyMessage?.selectedId ||
    m?.message?.buttonsResponseMessage?.selectedButtonId ||
    m?.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m?.text || "";

  const isCmd = body.startsWith(prefix);
  const fullCommand = isCmd ? body.slice(prefix.length).trim() : "";
  const args = fullCommand.split(" ");
  const baseCommand = args[0].toLowerCase();
  // Mendefinisikan partsCmd untuk navigasi alur berdasarkan underscore
  const partsCmd = baseCommand.split("_");

  const moment = require('moment-timezone');
  const time = moment(Date.now()).tz('Asia/Jakarta').locale('id').format('HH:mm:ss z');
  const groupMetadata = m.isGroup ? await chiwa.groupMetadata(m.chat).catch(e => { }) : '';
  const groupName = m.isGroup ? groupMetadata?.subject : '';

  // --- Load Data Produk ---
  const productsFile = path.join(__dirname, 'database', 'products.json');
  let products = [];
  if (fs.existsSync(productsFile)) {
    products = JSON.parse(fs.readFileSync(productsFile));
  } else {
    products = [
      { "title": "NETFLIX", "id": "netflix" },
      { "title": "VIDIO", "id": "vidio" },
      { "title": "VIU", "id": "viu" },
      { "title": "WETV", "id": "wetv" },
      { "title": "AMAZON PRIME VIDIO", "id": "apv" },
      { "title": "IQIYI", "id": "iqiyi" },
      { "title": "PEMBAYARAN", "id": "payment" },
      { "title": "PERBEDAAN NETFLIX", "id": "difnetflix" }
    ];
    fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));
  }
  const productRows = products.map(product => ({
    header: "",
    title: product.title,
    description: "",
    id: `${prefix}${product.id}`
  }));

  // --- Load Data Payment ---
  const paymentFile = path.join(__dirname, 'database', 'payment.json');
  let payments = [];
  if (fs.existsSync(paymentFile)) {
    payments = JSON.parse(fs.readFileSync(paymentFile));
  } else {
    payments = [];
    fs.writeFileSync(paymentFile, JSON.stringify(payments, null, 2));
  }

  // Log pesan masuk (pastikan ini tetap ada di awal)
  if (m.message) {
    console.log('[INFO]', time, chalk.green(body.slice(0, 100) || m.mtype), 'from', chalk.green(m.pushName || ''), 'in', chalk.green(groupName ? groupName : 'Private Chat'));
  }

  if (isCmd && !isRegistered && baseCommand !== 'register') {
    return m.reply(`╭───〔 BELUM TERDAFTAR 〕───
┊ Silahkan daftar terlebih dahulu untuk menggunakan bot
┊ Ketik ${prefix}register untuk mendaftar
╰─────────────────────────────`);
  }

  // --- Perintah Admin (Owner Only) ---
  if (isCmd && isOwner) {
    // Produk Management
    if (fullCommand.toLowerCase().startsWith("addproduct|")) {
      const productName = fullCommand.substring("addproduct|".length).trim();
      if (!productName) return m.reply("Format salah! Gunakan: addproduct|Nama Produk");
      const productId = productName.toLowerCase().replace(/\s+/g, '');
      if (products.find(p => p.id === productId)) return m.reply("Produk sudah ada.");
      products.push({ title: productName, id: productId });
      fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));
      return m.reply(`Produk ${productName} berhasil ditambahkan.`);
    }
    if (fullCommand.toLowerCase().startsWith("editproduct|")) {
      const parts = fullCommand.split("|");
      if (parts.length < 3) return m.reply("Format salah! Gunakan: editproduct|Nama Lama|Nama Baru");
      const oldName = parts[1].trim(), newName = parts[2].trim();
      if (!oldName || !newName) return m.reply("Nama lama atau nama baru tidak boleh kosong.");
      const oldId = oldName.toLowerCase().replace(/\s+/g, ''), newId = newName.toLowerCase().replace(/\s+/g, '');
      const index = products.findIndex(p => p.id === oldId);
      if (index < 0) return m.reply("Produk tidak ditemukan.");
      if (products.find(p => p.id === newId) && oldId !== newId) return m.reply("Produk dengan nama baru sudah ada.");
      products[index] = { title: newName, id: newId, categories: products[index].categories || [] };
      fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));
      return m.reply(`Produk berhasil diubah dari ${oldName} menjadi ${newName}.`);
    }
    if (fullCommand.toLowerCase().startsWith("deleteproduct|")) {
      const productName = fullCommand.substring("deleteproduct|".length).trim();
      if (!productName) return m.reply("Format salah! Gunakan: deleteproduct|Nama Produk");
      const productId = productName.toLowerCase().replace(/\s+/g, '');
      const index = products.findIndex(p => p.id === productId);
      if (index < 0) return m.reply("Produk tidak ditemukan.");
      const removed = products.splice(index, 1);
      fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));
      return m.reply(`Produk ${removed[0].title} berhasil dihapus.`);
    }
    // Kategori Management
    if (fullCommand.toLowerCase().startsWith("addkategori|")) {
      const parts = fullCommand.split("|");
      if (parts.length < 3) return m.reply("Format salah! Gunakan: addkategori|nama produk|kategori");
      const prodIdCandidate = parts[1].trim().toLowerCase();
      const kategori = parts[2].trim();
      const idx = products.findIndex(p => p.id === prodIdCandidate);
      if (idx < 0) return m.reply("Produk tidak ditemukan.");
      if (!products[idx].categories) products[idx].categories = [];
      if (products[idx].categories.includes(kategori)) return m.reply("Kategori sudah ada untuk produk tersebut.");

      // Tambahkan kategori ke dalam array
      products[idx].categories.push(kategori);

      // Jika pesan memiliki gambar, download dan simpan file gambarnya
      if (m.message && m.message.imageMessage) {
        try {
          // Dapatkan stream konten dari pesan
          const stream = await downloadContentFromMessage(m.message.imageMessage, 'image');
          let buffer = Buffer.from([]);
          for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
          }
          if (buffer.length) {
            // Tentukan ekstensi file berdasarkan mimetype (default ke .jpg)
            let ext = ".jpg";
            const mimetype = m.message.imageMessage.mimetype || "";
            if (mimetype.includes("png")) ext = ".png";
            else if (mimetype.includes("jpeg")) ext = ".jpg";
            // Nama file unik berdasarkan id produk dan timestamp
            const fileName = `${prodIdCandidate}_${Date.now()}${ext}`;
            // Folder penyimpanan gambar, sesuaikan dengan struktur project Anda
            const folderPath = path.join(__dirname, "/database/kategori_images");
            if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
            const filePath = path.join(folderPath, fileName);
            // Simpan file gambar ke disk
            fs.writeFileSync(filePath, buffer);
            // Simpan properti image di produk dengan format objek seperti contoh QRIS
            products[idx].image = {
              name: fileName,
              type: "image",
              data: filePath
            };
          }
        } catch (err) {
          console.error("Gagal mendownload atau menyimpan media:", err);
        }
      }

      fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));

      const pesan = `Kategori "${kategori}" berhasil ditambahkan untuk produk ${products[idx].title}.`;
      if (products[idx].image && products[idx].image.data) {
        return chiwa.sendMessage(m.chat, {
          image: fs.readFileSync(products[idx].image.data),
          caption: pesan
        }, { quoted: m });
      } else {
        return m.reply(pesan);
      }
    }

    if (fullCommand.toLowerCase().startsWith("editkategori|")) {
      const parts = fullCommand.split("|");
      if (parts.length < 4) return m.reply("Format salah! Gunakan: editkategori|nama produk|kategori lama|kategori baru");
      const prodIdCandidate = parts[1].trim().toLowerCase();
      const oldKategori = parts[2].trim(), newKategori = parts[3].trim();
      const idx = products.findIndex(p => p.id === prodIdCandidate);
      if (idx < 0) return m.reply("Produk tidak ditemukan.");
      if (!products[idx].categories) products[idx].categories = [];
      const catIndex = products[idx].categories.findIndex(cat => cat.toLowerCase() === oldKategori.toLowerCase());
      if (catIndex < 0) return m.reply("Kategori lama tidak ditemukan.");
      products[idx].categories[catIndex] = newKategori;
      fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));

      const pesan = `Kategori berhasil diubah dari "${oldKategori}" ke "${newKategori}" pada produk ${products[idx].title}.`;
      if (products[idx].image && products[idx].image.data) {
        return chiwa.sendMessage(m.chat, {
          image: fs.readFileSync(products[idx].image.data),
          caption: pesan
        }, { quoted: m });
      } else {
        return m.reply(pesan);
      }
    }

    if (fullCommand.toLowerCase().startsWith("deletekategori|")) {
      const parts = fullCommand.split("|");
      if (parts.length < 3) return m.reply("Format salah! Gunakan: deletekategori|nama produk|kategori");
      const prodIdCandidate = parts[1].trim().toLowerCase();
      const kategori = parts[2].trim();
      const idx = products.findIndex(p => p.id === prodIdCandidate);
      if (idx < 0) return m.reply("Produk tidak ditemukan.");
      if (!products[idx].categories) products[idx].categories = [];
      const catIndex = products[idx].categories.findIndex(cat => cat.toLowerCase() === kategori.toLowerCase());
      if (catIndex < 0) return m.reply("Kategori tidak ditemukan.");
      products[idx].categories.splice(catIndex, 1);
      fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));

      const pesan = `Kategori "${kategori}" berhasil dihapus dari produk ${products[idx].title}.`;
      if (products[idx].image && products[idx].image.data) {
        return chiwa.sendMessage(m.chat, {
          image: fs.readFileSync(products[idx].image.data),
          caption: pesan
        }, { quoted: m });
      } else {
        return m.reply(pesan);
      }
    }

    // Durasi Management (durasi disimpan sebagai objek: { name, price })
    if (fullCommand.toLowerCase().startsWith("adddurasi|")) {
      const parts = fullCommand.split("|");
      if (parts.length < 3) return m.reply("Format salah! Gunakan: adddurasi|nama kategori|durasi - harga");
      const kategori = parts[1].trim();
      const durasiPart = parts[2].trim();
      let [durasiName, durasiPrice] = durasiPart.split("-");
      if (!durasiName) return m.reply("Format durasi salah! Pastikan ada nama durasi.");
      durasiName = durasiName.trim();
      durasiPrice = durasiPrice ? durasiPrice.trim() : "";
      let updated = false;
      products.forEach(prod => {
        if (prod.categories) {
          for (let i = 0; i < prod.categories.length; i++) {
            if (typeof prod.categories[i] === 'string') {
              if (prod.categories[i].toLowerCase() === kategori.toLowerCase()) {
                prod.categories[i] = { name: prod.categories[i], durasi: [] };
              }
            }
            if (typeof prod.categories[i] === 'object') {
              if (prod.categories[i].name.toLowerCase() === kategori.toLowerCase()) {
                if (!prod.categories[i].durasi) prod.categories[i].durasi = [];
                if (prod.categories[i].durasi.find(d => (typeof d === 'object' ? d.name.toLowerCase() === durasiName.toLowerCase() : String(d).toLowerCase() === durasiName.toLowerCase()))) {
                  return m.reply("Durasi sudah ada untuk kategori tersebut.");
                } else {
                  prod.categories[i].durasi.push({ name: durasiName, price: durasiPrice });
                  updated = true;
                }
              }
            }
          }
        }
      });
      if (updated) {
        fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));
        return m.reply(`Durasi "${durasiName} - ${durasiPrice}" berhasil ditambahkan untuk kategori "${kategori}".`);
      } else {
        return m.reply("Kategori tidak ditemukan di produk manapun.");
      }
    }
    if (fullCommand.toLowerCase().startsWith("editdurasi|")) {
      const parts = fullCommand.split("|");
      if (parts.length < 4) return m.reply("Format salah! Gunakan: editdurasi|nama kategori|durasi lama|durasi baru");
      const kategori = parts[1].trim();
      const oldDurasi = parts[2].trim(), newDurasi = parts[3].trim();
      let updated = false;
      products.forEach(prod => {
        if (prod.categories) {
          for (let i = 0; i < prod.categories.length; i++) {
            if (typeof prod.categories[i] === 'object') {
              if (prod.categories[i].name.toLowerCase() === kategori.toLowerCase()) {
                if (prod.categories[i].durasi) {
                  let dIndex = prod.categories[i].durasi.findIndex(d => (typeof d === 'object' ? d.name.toLowerCase() === oldDurasi.toLowerCase() : String(d).toLowerCase() === oldDurasi.toLowerCase()));
                  if (dIndex >= 0) {
                    let [newName, newPrice] = newDurasi.split("-");
                    newName = newName.trim();
                    newPrice = newPrice ? newPrice.trim() : "";
                    prod.categories[i].durasi[dIndex] = { name: newName, price: newPrice };
                    updated = true;
                  }
                }
              }
            }
          }
        }
      });
      if (updated) {
        fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));
        return m.reply(`Durasi "${oldDurasi}" berhasil diubah menjadi "${newDurasi}" untuk kategori "${kategori}".`);
      } else {
        return m.reply("Durasi tidak ditemukan.");
      }
    }
    if (fullCommand.toLowerCase().startsWith("deletedurasi|")) {
      const parts = fullCommand.split("|");
      if (parts.length < 3) return m.reply("Format salah! Gunakan: deletedurasi|nama kategori|durasi");
      const kategori = parts[1].trim();
      const durasiToDelete = parts[2].trim();
      let updated = false;
      products.forEach(prod => {
        if (prod.categories) {
          for (let i = 0; i < prod.categories.length; i++) {
            if (typeof prod.categories[i] === 'object') {
              if (prod.categories[i].name.toLowerCase() === kategori.toLowerCase()) {
                if (prod.categories[i].durasi) {
                  let dIndex = prod.categories[i].durasi.findIndex(d => (typeof d === 'object' ? d.name.toLowerCase() === durasiToDelete.toLowerCase() : String(d).toLowerCase() === durasiToDelete.toLowerCase()));
                  if (dIndex >= 0) {
                    prod.categories[i].durasi.splice(dIndex, 1);
                    updated = true;
                  }
                }
              }
            }
          }
        }
      });
      if (updated) {
        fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));
        return m.reply(`Durasi "${durasiToDelete}" berhasil dihapus dari kategori "${kategori}".`);
      } else {
        return m.reply("Durasi tidak ditemukan.");
      }
    }
    // Payment Management
    function sanitizeFileName(name) {
      return name.replace(/[^a-z0-9_]/gi, '');
    }

    if (fullCommand.toLowerCase().startsWith("addpayment|")) {
      const parts = fullCommand.split("|");

      // Untuk rekening: .addpayment|nama pembayaran|norekening|atasnama
      // Untuk QRIS: .addpayment|nama pembayaran|(opsional: atasnama), jika kosong dan ada gambar, gambar akan disimpan.
      if (parts.length !== 3 && parts.length !== 4) {
        return m.reply("Format salah!\n• Untuk rekening: addpayment|nama pembayaran|norekening|atasnama\n• Untuk QRIS: addpayment|nama pembayaran|atasnama (atau kosong, jika ingin upload gambar)");
      }

      const payName = parts[1].trim();

      if (payments.find(p => p.name.toLowerCase() === payName.toLowerCase())) {
        return m.reply("Metode pembayaran sudah ada.");
      }

      if (parts.length === 4) {
        // Kasus rekening
        const noRek = parts[2].trim();
        const atasNama = parts[3].trim();
        if (!noRek || !atasNama) return m.reply("Nomor rekening atau atas nama tidak boleh kosong.");
        payments.push({
          name: payName,
          type: "rekening",
          data: { norek: noRek, atasnama: atasNama }
        });
        fs.writeFileSync(paymentFile, JSON.stringify(payments, null, 2));
        return m.reply(`Metode pembayaran "${payName}" (rekening) berhasil ditambahkan.`);

      } else if (parts.length === 3) {
        // Kasus QRIS
        let atasNama = parts[2].trim();
        let type = "qris";
        if (m.message?.imageMessage) {
          const buffer = await downloadMedia(chiwa, m);
          if (!buffer) return m.reply("Gagal mendownload gambar.");
          const paymentImagesDir = path.join(__dirname, 'database', 'payment_images');
          if (!fs.existsSync(paymentImagesDir)) fs.mkdirSync(paymentImagesDir, { recursive: true });
          // Sanitasi nama pembayaran untuk nama file
          const safePayName = sanitizeFileName(payName.toLowerCase().replace(/\s+/g, '_'));
          const fileName = `${safePayName}_${Date.now()}.jpg`;
          const filePath = path.join(paymentImagesDir, fileName);
          fs.writeFileSync(filePath, buffer);
          atasNama = filePath;
          type = "image";
        } else {
          if (!atasNama) return m.reply("Atas nama tidak ditemukan dan tidak ada gambar yang diupload.");
        }
        payments.push({
          name: payName,
          type,
          data: atasNama
        });
        fs.writeFileSync(paymentFile, JSON.stringify(payments, null, 2));
        return m.reply(`Metode pembayaran "${payName}" (QRIS) berhasil ditambahkan.`);
      }
    }
  } // End Perintah Admin

  // Pastikan di awal handler, format JID admin sudah benar
  let adminJID = process.env.OWNER_NUMBER;
  if (!adminJID.endsWith('@s.whatsapp.net')) {
    adminJID += '@s.whatsapp.net';
  }

  // Inisialisasi global untuk menyimpan nomor kwitansi yang sudah diproses dan mapping ke chat user beserta detail produk
  chiwa.processedReceipts = chiwa.processedReceipts || new Set();
  // Mapping ini tidak dihapus untuk perintah "send", sehingga bisa digunakan untuk mengirim data akun berkali-kali
  chiwa.receipts = chiwa.receipts || {};

  // --- Pengecekan Pesan Admin ---
  if (m.sender === adminJID && (m.message?.conversation || m.message?.extendedTextMessage?.text)) {
    const adminText = m.message.conversation || m.message.extendedTextMessage?.text || "";
    const trimmedText = adminText.trim();

    // Perintah konfirmasi "masuk|<nomor kwitansi>" atau "not|<nomor kwitansi>"
    const confirmMatch = trimmedText.match(/^(masuk|not)\|(\d{8})$/i);
    if (confirmMatch) {
      const status = confirmMatch[1].toLowerCase(); // "masuk" atau "not"
      const receiptNumber = confirmMatch[2];
      if (chiwa.receipts[receiptNumber]) {
        const { chat: userChat, productTitle } = chiwa.receipts[receiptNumber];
        let confirmationMsg = "";
        if (status === "masuk") {
          confirmationMsg = `✅ Pembayaran anda telah di konfirmasi masuk. Akun ${productTitle} akan segera di kriim.`;
        } else {
          confirmationMsg = "❌ Pembayaran anda belum sesuai. Silahkan hubungi admin untuk informasi lebih lanjut.";
        }
        await chiwa.sendMessage(userChat, { text: confirmationMsg });
        return m.reply("Pesan konfirmasi telah dikirim ke user.");
      } else {
        return m.reply("Nomor kwitansi tidak ditemukan atau belum pernah dikirim bukti transfer.");
      }
    }

    // Perintah Kirim Data Akun: send|<nomor kwitansi>|<data akun>
    // Data akun dapat berupa teks panjang/multiline tanpa pembatas khusus.
    const sendMatch = trimmedText.match(/^send\|(\d{8})\|([\s\S]+)$/i);
    if (sendMatch) {
      const receiptNumber = sendMatch[1];
      const accountData = sendMatch[2].trim();
      if (chiwa.receipts[receiptNumber]) {
        const { chat: userChat, productTitle, orderDurasi } = chiwa.receipts[receiptNumber];

        // Kirim data akun ke user
        await chiwa.sendMessage(
          userChat,
          { text: `🔑 *Akun ${productTitle} Anda:*\n\n${accountData}` }
        );

        // Jika data durasi tersedia dari bukti transfer, hitung tanggal habis secara otomatis.
        if (orderDurasi) {
          let days = 30; // default 30 hari
          // Jika format durasi mengandung kata "bulan"
          const bulanMatch = orderDurasi.match(/(\d+)\s*bulan/i);
          if (bulanMatch) {
            days = parseInt(bulanMatch[1]) * 30;
          } else {
            // Jika mengandung kata "hari"
            const hariMatch = orderDurasi.match(/(\d+)\s*hari/i);
            if (hariMatch) {
              days = parseInt(hariMatch[1]);
            } else {
              // Jika hanya angka
              const numberMatch = orderDurasi.match(/(\d+)/);
              if (numberMatch) {
                days = parseInt(numberMatch[1]);
              }
            }
          }
          const moment = require('moment-timezone');
          const purchaseDate = moment().tz('Asia/Jakarta');
          const expiryDate = purchaseDate.clone().add(days, 'days');

          // Kirim pesan ke user dengan info tanggal habis
          let confirmationText = `✅ Data akun telah dikirim. Akun ${productTitle} Anda akan berakhir pada ${expiryDate.format('DD/MM/YYYY')}.`;
          await chiwa.sendMessage(userChat, { text: confirmationText });

          // Hitung waktu untuk reminder: expiryDate dikurangi 2 hari (misal, 29/03/2025)
          const reminderTime = expiryDate.clone().subtract(2, 'days').valueOf() - Date.now();
          if (reminderTime > 0) {
            setTimeout(async () => {
              await chiwa.sendMessage(
                userChat,
                { text: `⏰ Reminder: Akun ${productTitle} Anda akan berakhir pada ${expiryDate.format('DD/MM/YYYY')}.` }
              );
            }, reminderTime);
          }
        }
        return m.reply("Data akun dan durasi telah dikirim ke user.");
      } else {
        return m.reply("Nomor kwitansi tidak ditemukan atau belum pernah dikirim bukti transfer.");
      }
    }
  }


  // --- Pengecekan Bukti Transfer dari User ---
  // (Pastikan kode ini berada di awal handler, setelah pengecekan pesan admin)

  if (m.message?.imageMessage) {
    // Abaikan pesan yang dikirim oleh bot sendiri
    if (m.key && m.key.fromMe) return;

    // Abaikan pesan yang berasal dari admin
    if (m.sender === adminJID) return;

    // Ambil caption jika ada
    let caption = m.message.imageMessage.caption ? m.message.imageMessage.caption.trim() : "";
    let receiptNumberReceived = null;

    // Coba cari pola 8 digit di caption
    let match = caption.match(/\b\d{8}\b/);
    if (match) {
      receiptNumberReceived = match[0];
    } else {
      // Jika tidak ada caption atau pola tidak ditemukan, generate nomor kwitansi otomatis
      receiptNumberReceived = moment().tz('Asia/Jakarta').format('DDMMYY') + (Math.floor(Math.random() * 90) + 10);
    }

    // Jika nomor kwitansi ini sudah pernah diproses, jangan ulangi
    if (chiwa.processedReceipts.has(receiptNumberReceived)) return;
    chiwa.processedReceipts.add(receiptNumberReceived);

    // Ambil data order (jika ada)
    const order = chiwa.order && chiwa.order[m.chat];
    let productTitle = "";
    let categoryName = "";
    let durationName = "";
    let durationPrice = "";
    if (order) {
      const selectedProduct = products.find(p => p.id === order.product);
      productTitle = selectedProduct ? selectedProduct.title : "";
      categoryName = order.category || "";
      durationName = order.durasi || ""; // misal: "2 bulan" atau "30 hari"
      if (selectedProduct && selectedProduct.categories) {
        for (let cat of selectedProduct.categories) {
          if (
            typeof cat === 'object' &&
            cat.name.toLowerCase().replace(/\s+/g, '') === order.category
          ) {
            if (cat.durasi && Array.isArray(cat.durasi)) {
              let dur = cat.durasi.find(d =>
                d.name.toLowerCase().replace(/\s+/g, '') === order.durasi
              );
              if (dur) {
                durationPrice = dur.price || "";
              }
            }
            break;
          }
        }
      }
    }

    // Download bukti transfer
    const buktiBuffer = await downloadMedia(chiwa, m);
    if (!buktiBuffer) return m.reply("Gagal mendownload bukti transfer.");

    // Simpan mapping nomor kwitansi ke chat user beserta detail produk dan durasi yang dipilih
    chiwa.receipts[receiptNumberReceived] = {
      chat: m.chat,
      productTitle,
      orderDurasi: order ? order.durasi : null  // simpan misal: "2 bulan"
    };

    // Buat pesan notifikasi untuk admin dengan detail order
    const verificationMsg = `💠 *Bukti Transfer Diterima* 💠
──────────────────────────
No. Kwitansi: ${receiptNumberReceived}
Produk     : ${productTitle}
Kategori   : ${categoryName}
Durasi     : ${durationName}
Harga      : ${durationPrice}

Mohon segera verifikasi pembayaran ini.
Ketik:
*masuk|${receiptNumberReceived}* → Jika saldo masuk
*not|${receiptNumberReceived}* → Jika saldo belum masuk
*send|${receiptNumberReceived}|data akun* → Untuk mengirim data akun ke user`;

    await chiwa.sendMessage(adminJID, { image: buktiBuffer, caption: verificationMsg });

    if (chiwa.order) delete chiwa.order[m.chat];

    return m.reply("✨ Bukti transfer telah dikirim ke admin. Mohon tunggu konfirmasi selanjutnya. ✨");
  }

  // --- Tampilan Utama (misalnya welcome message) ---
  if (!isCmd && !m.isGroup && !m.key.fromMe) {
    return await chiwa.sendButtonMsg(m.chat, {
      text: `✨ WELCOME TO CAKSTORE ✨

🚀 Toko Aplikasi Premium Terpercaya!
✅ Murah, cepat, & aman!
✅ Hiburan tanpa batas!

📌Gunakan *Tombol* untuk memilih pilihan

📌Tekan *Lihat Produk* untuk melihat layanan!`,
      footer: 'ig : @cakstore2024',
      buttons: [
        { buttonId: prefix + "testimoni", buttonText: { displayText: "Testimoni" }, type: 1 },
        { buttonId: prefix + "cs", buttonText: { displayText: "Customer Service" }, type: 1 },
        {
          buttonId: "listbtns",
          buttonText: { displayText: "Lihat Produk" },
          nativeFlowInfo: {
            name: "single_select",
            paramsJson: JSON.stringify({
              title: "Lihat Produk",
              sections: [{ title: "Lihat Produk", highlight_label: "Produk", rows: productRows }]
            })
          },
          type: 2
        }
      ]
    }, { quoted: m });
  }

  // --- Navigasi User Berdasarkan Command Underscore ---
  // 1. Jika hanya produk, tampilkan kategori (jika ada)
  if (partsCmd.length === 1) {
    const selectedProduct = products.find(p => p.id === baseCommand);
    if (selectedProduct && selectedProduct.categories && selectedProduct.categories.length > 0) {
      const categoryMsg = `〔 PILIH KATEGORI 〕
  │ Produk : *${selectedProduct.title}*
  │ 
  │ Silakan pilih salah satu kategori:
  ╰─────────────────────────`;
      // Jika jumlah kategori lebih dari 3, gunakan single select
      if (selectedProduct.categories.length > 3) {
        const categoryRows = selectedProduct.categories.map(cat => {
          const catName = (typeof cat === 'object') ? cat.name : cat;
          return {
            header: "",
            title: catName,
            description: "",
            id: `${prefix}${selectedProduct.id}_${catName.replace(/\s+/g, '')}`
          };
        });
        if (selectedProduct.image && selectedProduct.image.data) {
          return chiwa.sendButtonMsg(m.chat, {
            image: fs.readFileSync(selectedProduct.image.data),
            caption: categoryMsg,
            footer: '@CakStore',
            buttons: [{
              buttonId: "listbtns",
              buttonText: { displayText: "Pilih Kategori" },
              nativeFlowInfo: {
                name: "single_select",
                paramsJson: JSON.stringify({
                  title: categoryMsg,
                  sections: [{ title: "Kategori", highlight_label: "Pilih kategori", rows: categoryRows }]
                })
              },
              type: 2
            }]
          }, { quoted: m });
        } else {
          return chiwa.sendButtonMsg(m.chat, {
            text: categoryMsg,
            footer: '@CakStore',
            buttons: [{
              buttonId: "listbtns",
              buttonText: { displayText: "Pilih Kategori" },
              nativeFlowInfo: {
                name: "single_select",
                paramsJson: JSON.stringify({
                  title: categoryMsg,
                  sections: [{ title: "Kategori", highlight_label: "Pilih kategori", rows: categoryRows }]
                })
              },
              type: 2
            }]
          }, { quoted: m });
        }
      } else {
        // Jika kategori kurang atau sama dengan 3, gunakan button biasa
        const categoryButtons = selectedProduct.categories.map(cat => {
          const catName = (typeof cat === 'object') ? cat.name : cat;
          return {
            buttonId: `${prefix}${selectedProduct.id}_${catName.replace(/\s+/g, '')}`,
            buttonText: { displayText: catName },
            type: 1
          };
        });
        if (selectedProduct.image && selectedProduct.image.data) {
          return chiwa.sendButtonMsg(m.chat, {
            image: fs.readFileSync(selectedProduct.image.data),
            caption: categoryMsg,
            footer: '@CakStore',
            buttons: categoryButtons
          }, { quoted: m });
        } else {
          return chiwa.sendButtonMsg(m.chat, {
            text: categoryMsg,
            footer: '@CakStore',
            buttons: categoryButtons
          }, { quoted: m });
        }
      }
    }
  }

  // 2. Jika ada 2 bagian (produk_kategori), tampilkan pilihan durasi (jika ada)
  if (partsCmd.length === 2) {
    const prodId = partsCmd[0];
    const catId = partsCmd[1];
    const selectedProduct = products.find(p => p.id === prodId);
    if (selectedProduct && selectedProduct.categories) {
      let categoryItem = null;
      for (let cat of selectedProduct.categories) {
        if (typeof cat === 'object') {
          if (cat.name.toLowerCase().replace(/\s+/g, '') === catId) {
            categoryItem = cat;
            break;
          }
        } else {
          if (cat.toLowerCase().replace(/\s+/g, '') === catId) {
            categoryItem = { name: cat, durasi: [] };
            break;
          }
        }
      }
      if (categoryItem && categoryItem.durasi && categoryItem.durasi.length > 0) {
        const durasiMsg = `〔 PILIH DURASI 〕
│ Kategori : *${categoryItem.name}*
│ Silakan pilih durasi:
╰─────────────────────────`;
        if (categoryItem.durasi.length > 3) {
          const durasiRows = categoryItem.durasi.map(dur => {
            let durVal = "", durPrice = "";
            if (typeof dur === 'object' && dur.name) {
              durVal = dur.name;
              durPrice = dur.price ? dur.price : "";
            } else {
              durVal = String(dur);
            }
            return {
              header: "",
              title: durPrice ? `${durVal} - ${durPrice}` : durVal,
              description: durPrice ? `Harga: ${durPrice}` : "",
              id: `${prefix}${selectedProduct.id}_${categoryItem.name.toLowerCase().replace(/\s+/g, '')}_${durVal.toLowerCase().replace(/\s+/g, '')}`
            };
          });
          return chiwa.sendButtonMsg(m.chat, {
            text: durasiMsg,
            footer: '@CakStore',
            buttons: [{
              buttonId: "listbtns",
              buttonText: { displayText: "Pilih Durasi" },
              nativeFlowInfo: {
                name: "single_select",
                paramsJson: JSON.stringify({
                  title: durasiMsg,
                  sections: [{ title: "Durasi", highlight_label: "Pilih durasi", rows: durasiRows }]
                })
              },
              type: 2
            }]
          }, { quoted: m });
        } else {
          const durasiButtons = categoryItem.durasi.map(dur => {
            let durVal = "", durPrice = "";
            if (typeof dur === 'object' && dur.name) {
              durVal = dur.name;
              durPrice = dur.price ? dur.price : "";
            } else {
              durVal = String(dur);
            }
            return {
              buttonId: `${prefix}${selectedProduct.id}_${categoryItem.name.toLowerCase().replace(/\s+/g, '')}_${durVal.toLowerCase().replace(/\s+/g, '')}`,
              buttonText: { displayText: durPrice ? `${durVal} - ${durPrice}` : durVal },
              type: 1
            };
          });
          return chiwa.sendButtonMsg(m.chat, {
            text: durasiMsg,
            footer: '@CakStore',
            buttons: durasiButtons
          }, { quoted: m });
        }
      } else {
        // Jika tidak ada pilihan durasi, langsung lanjut ke pembayaran
        partsCmd.push("default");
      }
    }
  }
  // 3. Jika ada 3 bagian (produk_kategori_durasi), simpan data order dan tampilkan pilihan pembayaran
  // Bagian pemilihan pembayaran (tetap menampilkan format lama)
  if (partsCmd.length === 3) {
    const prodId = partsCmd[0];
    const catId = partsCmd[1];
    const durasiId = partsCmd[2];
  
    // Simpan data order berdasarkan pilihan user
    chiwa.order = chiwa.order || {};
    chiwa.order[m.chat] = {
      product: prodId,
      category: catId,
      durasi: durasiId
    };
  
    const paymentMsg = `〔 PILIH PEMBAYARAN 〕
  │ Produk : *${prodId.toUpperCase()}*
  │ Durasi : *${durasiId}*
  │ 
  │ Silakan pilih metode pembayaran:
  ╰──────────────────────────────`;
  
    if (payments.length > 0) {
      if (payments.length > 3) {
        const paymentRows = payments.map(pay => ({
          header: "",
          title: pay.name,
          // Jika rekening, tampilkan "No. Rek: <norek> (<atasnama>)", jika QRIS tampilkan "QRIS"
          description: (pay.type === "rekening")
            ? `No. Rek: ${pay.data.norek} (${pay.data.atasnama})`
            : "QRIS",
          id: `${prefix}payment_${pay.name.toLowerCase().replace(/\s+/g, '')}`
        }));
        return chiwa.sendButtonMsg(m.chat, {
          text: paymentMsg,
          footer: '@CakStore',
          buttons: [{
            buttonId: "listbtns",
            buttonText: { displayText: "Pilih Pembayaran" },
            nativeFlowInfo: {
              name: "single_select",
              paramsJson: JSON.stringify({
                title: paymentMsg,
                sections: [{
                  title: "Pembayaran",
                  highlight_label: "Pilih pembayaran",
                  rows: paymentRows
                }]
              })
            },
            type: 2
          }]
        }, { quoted: m });
      } else {
        const paymentButtons = payments.map(pay => {
          let displayText = pay.name;
          if (pay.type === "rekening") {
            displayText += ` (No. Rek: ${pay.data.norek} (${pay.data.atasnama}))`;
          }
          return {
            buttonId: `${prefix}payment_${pay.name.toLowerCase().replace(/\s+/g, '')}`,
            buttonText: { displayText },
            type: 1
          };
        });
        return chiwa.sendButtonMsg(m.chat, {
          text: paymentMsg,
          footer: '@CakStore',
          buttons: paymentButtons
        }, { quoted: m });
      }
    } else {
      return m.reply("Belum ada metode pembayaran yang tersedia.");
    }
  }
  
  // 4. Jika command diawali dengan "payment_", artinya user memilih metode pembayaran
  if (baseCommand.startsWith("payment_")) {
    const payName = baseCommand.replace("payment_", "");
    const selectedPayment = payments.find(
      p => p.name.toLowerCase().replace(/\s+/g, '') === payName
    );
    if (!selectedPayment) return m.reply("Metode pembayaran tidak ditemukan.");
  
    // Ambil data order yang tersimpan
    if (!chiwa.order || !chiwa.order[m.chat]) {
      return m.reply("Data order tidak ditemukan. Silakan pilih produk terlebih dahulu.");
    }
    const order = chiwa.order[m.chat];
    if (!order.product || !order.category || !order.durasi) {
      return m.reply("Data order tidak lengkap. Pastikan memilih produk, kategori, dan durasi.");
    }
  
    // Cari data produk berdasarkan order.product
    const selectedProduct = products.find(p => p.id === order.product);
    if (!selectedProduct) return m.reply("Produk tidak ditemukan.");
  
    let selectedCategory = null;
    let selectedDuration = null;
  
    // Cari kategori di dalam produk (kategori bisa berupa string atau objek)
    if (selectedProduct.categories) {
      for (let cat of selectedProduct.categories) {
        if (typeof cat === 'object') {
          if (cat.name.toLowerCase().replace(/\s+/g, '') === order.category) {
            selectedCategory = cat.name;
            // Cari durasi di dalam kategori
            if (cat.durasi && Array.isArray(cat.durasi)) {
              selectedDuration = cat.durasi.find(d =>
                d.name.toLowerCase().replace(/\s+/g, '') === order.durasi
              );
            }
            break;
          }
        } else if (typeof cat === 'string') {
          if (cat.toLowerCase().replace(/\s+/g, '') === order.category) {
            selectedCategory = cat;
            break;
          }
        }
      }
    }
  
    if (!selectedCategory) return m.reply("Kategori tidak ditemukan.");
    if (!selectedDuration) return m.reply("Pilihan durasi tidak ditemukan.");
  
    // --- Membuat kwitansi pembayaran ---
    const moment = require('moment-timezone');
    const receiptDate = moment().tz('Asia/Jakarta').format('DD/MM/YYYY');
    const receiptTime = moment().tz('Asia/Jakarta').format('HH:mm:ss z');
    // Format: ddmmyy + angka acak dua digit (misalnya: 01032522)
    const receiptNumber = moment().tz('Asia/Jakarta').format('DDMMYY') + (Math.floor(Math.random() * 90) + 10);
  
    const receiptMsg = `📄 KWITANSI PEMBAYARAN  
  ────────────────────  
  📅 Tanggal: ${receiptDate}  
  ⏰ Jam: ${receiptTime}  
  🧾 No. Kwitansi: ${receiptNumber}  
  
  👤 Nama WA: ${m.pushName}  
  📞 No. WA: ${m.sender}  
  
  📦 Produk: ${selectedProduct.title}  
  📂 Kategori: ${selectedCategory}  
  ⏳ Durasi: ${selectedDuration.name}  
  
  💰 Harga: ${selectedDuration.price}  
  💳 Metode Pembayaran: ${selectedPayment.name}${
    selectedPayment.type === "rekening" 
      ? ` (No. Rek: ${selectedPayment.data.norek} (${selectedPayment.data.atasnama}))`
      : ""
  }  
  
  📌 KIRIM BUKTI TRANSFER ANDA DI SINI`;
  
    if (selectedPayment.type === "rekening") {
      // Jika pembayaran dengan rekening, kirim kwitansi sebagai pesan teks
      return chiwa.sendMessage(m.chat, { text: receiptMsg }, { quoted: m });
    } else {
      // Jika pembayaran dengan QRIS (misalnya tipe "image"), kirim kwitansi beserta gambar QRIS
      return chiwa.sendMessage(m.chat, { image: { url: selectedPayment.data }, caption: receiptMsg }, { quoted: m });
    }
  }  

  // --- Eksekusi Plugin Jika Perintah Lain ---
  const menu_data = require('./database/menu.json');
  const falias = (cmd) => {
    for (const category in menu_data) {
      for (const key in menu_data[category]) {
        if (key === cmd || menu_data[category][key].alias.includes(cmd)) {
          return key;
        }
      }
    }
    return cmd;
  };
  const fc = (cmd) => {
    let bm = null;
    let hs = 0;
    for (const category in menu_data) {
      for (const key in menu_data[category]) {
        const distance = levenshtein.get(cmd, key);
        const ml = Math.max(cmd.length, key.length);
        const sml = ((ml - distance) / ml) * 100;
        if (sml > hs) {
          hs = sml;
          bm = key;
        }
      }
    }
    return { bm, hs };
  };
  try {
    if (baseCommand) {
      const oc = falias(baseCommand);
      require(`./plugins/${oc}`)(chiwa, m, isRegistered, fullCommand, isOwner, baseCommand, prefix);
    }
  } catch (e) {
    if (e.code && e.code.includes('MODULE_NOT_FOUND')) {
      if (isRegistered && process.env.CORRECT_COMMAND === 'true') {
        const { bm, hs } = fc(baseCommand);
        if (bm && hs > 50) {
          m.reply(`Perintah tidak ditemukan. Apakah kamu bermaksud *${bm}*? (${hs.toFixed(2)}% kecocokan)`);
        }
      }
    }
  }

  switch (baseCommand) {
    // Tambahan case jika diperlukan
  }

};

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});
const pluginsDir = path.join(__dirname, 'plugins');
fs.readdirSync(pluginsDir).forEach(file => {
  const pluginPath = path.join(pluginsDir, file);
  if (fs.lstatSync(pluginPath).isFile() && file.endsWith('.js')) {
    fs.watchFile(pluginPath, () => {
      fs.unwatchFile(pluginPath);
      console.log(chalk.greenBright(`Update detected in ${pluginPath}`));
      delete require.cache[require.resolve(pluginPath)];
      require(pluginPath);
    });
  }
});
let chi = require.resolve('./database/menu.json');
fs.watchFile(file, () => {
  fs.unwatchFile(chi);
  console.log(chalk.redBright(`Update ./database/menu.json`));
  delete require.cache[chi];
  require(chi);
});
