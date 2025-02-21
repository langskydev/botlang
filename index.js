// index.js

// Override console logging di environment production untuk mengurangi spam log
if (process.env.NODE_ENV === 'production') {
    console.log = () => { };
    console.debug = () => { };
    console.info = () => { };
}

const pino = require('pino'); // Impor pino untuk mengatur level logger
const { DisconnectReason, makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const groupConfig = require('./src/groupConfig');
const listFeature = require('./src/fitur/store/list');
const priceManager = require('./src/fitur/store/managePrice');
// Impor fitur pesan pesanan (pending)
const pendingOrder = require('./src/fitur/store/pesanPesanan');
const { welcomeHandler } = require('./src/fitur/group/welcome');
const { hidetag } = require('./src/fitur/group/hidetag');
const { antilinkHandler } = require('./src/fitur/group/antilink');
const { handleForbiddenWordCommand, forbiddenWordChecker } = require('./src/fitur/group/forbiddenWords');
const { tutupGrup } = require('./src/fitur/group/tutupGrup');
const { bukaGrup } = require('./src/fitur/group/bukaGrup');
const { handleAfk } = require('./src/fitur/group/afk');
// Impor file backup agar cronjob berjalan
require('./src/backup/backup');
// Import file promote
const { handlePromote } = require('./src/fitur/owner/promote');

// Cek agar file tempcoderunnerfile.js tidak digunakan
if (process.argv[1] && process.argv[1].includes('tempcoderunnerfile.js')) {
    console.log('Jalankan file index.js, bukan tempcoderunnerfile.js');
    process.exit(0);
}

async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            // Atur logger untuk hanya menampilkan pesan error
            logger: pino({ level: 'error' })
        });

        // Menangani update koneksi
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                console.log('Connection closed due to', lastDisconnect?.error, ', reconnecting:', shouldReconnect);
                if (shouldReconnect) {
                    // Beri delay 5 detik sebelum reconnect
                    setTimeout(connectToWhatsApp, 5000);
                }
            } else if (connection === 'open') {
                console.log('WhatsApp Bot Connected');
            }
        });

        // Tangani error global pada socket
        sock.ev.on('error', (err) => {
            console.error('Socket error:', err);
        });

        sock.ev.on('creds.update', saveCreds);

        // Pendaftaran event group-participants.update hanya sekali (di luar messages.upsert)
        sock.ev.on('group-participants.update', async (update) => {
            await welcomeHandler(sock, update);
        });

        sock.ev.on('messages.upsert', async (event) => {
            for (const m of event.messages) {
                if (!m.message) continue;
                if (m.key.fromMe) continue;

                await handleAfk(sock, m);
                await hidetag(sock, m);
                await forbiddenWordChecker(sock, m);
                await antilinkHandler(sock, m);
                await tutupGrup(sock, m);
                await bukaGrup(sock, m);

                const remoteJid = m.key.remoteJid;

                if (!remoteJid.endsWith('@g.us')) {
                    await handlePromote(sock, m);
                    await handleForbiddenWordCommand(sock, m);
                }

                // Jika pesan berasal dari grup yang diizinkan, panggil fitur list
                if (groupConfig.allowedGroups.includes(remoteJid)) {
                    listFeature.handleMessage(sock, m);
                }

                // Panggil fitur harga untuk perintah add/edit/delete dan query harga
                priceManager.handlePriceCommand(sock, m);

                // Panggil fitur pesan pesanan (pending) ketika admin reply pesan "p"
                pendingOrder.handlePendingMessage(sock, m);
            }
        });
    } catch (error) {
        console.error('Error saat menghubungkan ke WhatsApp:', error);
        // Jika terjadi error saat inisialisasi, tunggu 5 detik sebelum mencoba kembali
        setTimeout(connectToWhatsApp, 5000);
    }
}

connectToWhatsApp();
