const {
  DisconnectReason,
  makeWASocket,
  useMultiFileAuthState,
} = require("@whiskeysockets/baileys");
const { handleWelcome } = require("./src/fitur/group/welcome");
const { handleList } = require("./src/fitur/group/list");
const { handleOrderProcess } = require("./src/fitur/group/orderProcess");
const { handleGroupManage } = require("./src/fitur/admin/groupManage");
const { hidetag } = require("./src/fitur/admin/hidetag");
const { handleAntilink } = require("./src/fitur/group/antilink");
const { handleAntibadwordGroup } = require("./src/fitur/group/antibadword");

const { handleWelcomeControl } = require("./src/fitur/owner/welcomeControl");
const {
  handleListProductControl,
} = require("./src/fitur/owner/listProductControl");
const { handlePromote } = require("./src/fitur/owner/promote");
const { handleResetLink } = require("./src/fitur/owner/resetlink");
const { handleSetPP } = require("./src/fitur/owner/setpp");
const { handleRename } = require("./src/fitur/owner/rename");

const { handleAntilinkControl } = require("./src/fitur/owner/antilinkControl");
const { handleAntibadword } = require("./src/fitur/owner/antibadword");
const { groupId } = require("./src/config");
const fs = require("fs");
const path = require("path");

// Jalankan backup (jika diperlukan)
require("./src/backup");

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    browser: ["Chrome", "Desktop", "1.0"],
    usePairingCode: true, // Aktifkan pairing code
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "open") {
      console.log("Bot connect");
    } else if (connection === "close") {
      if (
        lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
      ) {
        connectToWhatsApp();
      } else {
        console.log("Bot berhenti");
      }
    }
  });

  sock.ev.removeAllListeners("messages.upsert");

  sock.ev.on("creds.update", saveCreds);

  // --- Fitur Owner (Chat Pribadi) ---
  handleWelcomeControl(sock);
  handleListProductControl(sock);
  handlePromote(sock);
  handleResetLink(sock);
  handleSetPP(sock);
  handleRename(sock);
  handleAntilinkControl(sock);

  // --- Fitur Grup (Hanya aktif untuk grup dengan ID = groupId) ---
  // Semua fitur grup hanya akan diproses jika pesan berasal dari grup yang sesuai.
  handleWelcome(sock);
  handleOrderProcess(sock);
  handleGroupManage(sock);
  handleAntilink(sock);
  handleAntibadword(sock);
  handleAntibadwordGroup(sock);

  // Handler untuk hidetag, hanya untuk grup yang id-nya tepat groupId
  sock.ev.on("messages.upsert", async (event) => {
    for (const message of event.messages) {
      if (message.key.fromMe) continue;
      const chatId = message.key.remoteJid;
      if (chatId !== groupId) continue; // Hanya proses pesan dari grup target
      await hidetag(sock, message);
    }
  });

  // Handler pesan utama untuk perintah grup (lookup produk, list, dsb)
  sock.ev.on("messages.upsert", async (event) => {
    // Fungsi sinkron untuk membaca daftar badword
    const BADWORD_FILE = path.join(
      __dirname,
      "src",
      "database",
      "badword",
      "badwords.json"
    );
    function readBadwordsSync() {
      if (!fs.existsSync(BADWORD_FILE)) return [];
      try {
        const data = fs.readFileSync(BADWORD_FILE, "utf8");
        return JSON.parse(data);
      } catch (err) {
        console.error("Error membaca badword:", err);
        return [];
      }
    }
    const badwords = readBadwordsSync();

    for (const message of event.messages) {
      if (message.key.fromMe || !message.message) continue;

      const chatId = message.key.remoteJid;
      if (chatId !== groupId) continue; // Proses hanya dari grup target

      let text = "";
      if (message.message.conversation) {
        text = message.message.conversation;
      } else if (message.message.extendedTextMessage?.text) {
        text = message.message.extendedTextMessage.text;
      }
      text = text.trim().toLowerCase();

      // Jika pesan mengandung badword, lewati pemrosesan perintah
      const containsForbidden = badwords.some((word) => text.includes(word));
      if (containsForbidden) continue;

      // Struktur switch-case untuk perintah grup
      switch (text) {
        case "list":
          await handleList(sock, message);
          break;
        case "p":
        case "d":
        case "cl":
        case "op":
          // Perintah-perintah ini sudah diproses di modul masing-masing
          break;
        default:
          // Lookup produk berdasarkan nama
          const dataFilePath = path.join(
            __dirname,
            "database",
            "listproduct",
            "data.json"
          );
          let productData = {};
          try {
            if (fs.existsSync(dataFilePath)) {
              const data = await fs.promises.readFile(dataFilePath, "utf8");
              productData = JSON.parse(data);
            }
          } catch (err) {
            console.error("Error reading product data:", err);
          }
          if (productData.hasOwnProperty(text)) {
            const product = productData[text];
            if (
              product &&
              typeof product === "object" &&
              product.image &&
              fs.existsSync(product.image)
            ) {
              const imgBuffer = fs.readFileSync(product.image);
              await sock.sendMessage(
                chatId,
                { image: imgBuffer, caption: product.price },
                { quoted: message }
              );
            } else if (product && typeof product === "object") {
              await sock.sendMessage(
                chatId,
                { text: product.price },
                { quoted: message }
              );
            } else {
              await sock.sendMessage(
                chatId,
                { text: product },
                { quoted: message }
              );
            }
          } else {
            await sock.sendMessage(
              chatId,
              {
                text: "Perintah tidak dikenali. Silahkan ketik perintah yang valid.",
              },
              { quoted: message }
            );
          }
          break;
      }
    }
  });
}

connectToWhatsApp();
