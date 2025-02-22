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
        // Tambahkan queryTimeoutMs untuk memperpanjang waktu timeout query (misalnya 60 detik)
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: pino({ level: 'error' }),
            queryTimeoutMs: 60000 // timeout query diperpanjang menjadi 60 detik
        });

        // Menangani update koneksi
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                if (lastDisconnect?.error) {
                    console.error('Connection closed due to', lastDisconnect.error, ', reconnecting:', shouldReconnect);
                }
                if (shouldReconnect) {
                    setTimeout(connectToWhatsApp, 5000);
                }
            }
        });

        // Tangani error global pada socket
        sock.ev.on('error', (err) => {
            console.error('Socket error:', err);
        });

        sock.ev.on('creds.update', saveCreds);

        // Pendaftaran event group-participants.update hanya sekali (di luar messages.upsert)
        sock.ev.on('group-participants.update', async (update) => {
            try {
                await welcomeHandler(sock, update);
            } catch (error) {
                console.error('Error pada welcomeHandler:', error);
            }
        });

        sock.ev.on('messages.upsert', async (event) => {
            for (const m of event.messages) {
                if (!m.message) continue;
                if (m.key.fromMe) continue;

                try {
                    await handleAfk(sock, m);
                } catch (error) {
                    console.error('Error di handleAfk:', error);
                }

                try {
                    await hidetag(sock, m);
                } catch (error) {
                    console.error('Error di hidetag:', error);
                }

                try {
                    await forbiddenWordChecker(sock, m);
                } catch (error) {
                    console.error('Error di forbiddenWordChecker:', error);
                }

                try {
                    await antilinkHandler(sock, m);
                } catch (error) {
                    console.error('Error di antilinkHandler:', error);
                }

                try {
                    await tutupGrup(sock, m);
                } catch (error) {
                    console.error('Error di tutupGrup:', error);
                }

                try {
                    await bukaGrup(sock, m);
                } catch (error) {
                    console.error('Error di bukaGrup:', error);
                }

                const remoteJid = m.key.remoteJid;

                if (!remoteJid.endsWith('@g.us')) {
                    try {
                        await handlePromote(sock, m);
                    } catch (error) {
                        console.error('Error di handlePromote:', error);
                    }

                    try {
                        await handleForbiddenWordCommand(sock, m);
                    } catch (error) {
                        console.error('Error di handleForbiddenWordCommand:', error);
                    }
                }

                if (groupConfig.allowedGroups.includes(remoteJid)) {
                    try {
                        listFeature.handleMessage(sock, m);
                    } catch (error) {
                        console.error('Error di listFeature.handleMessage:', error);
                    }
                }

                try {
                    priceManager.handlePriceCommand(sock, m);
                } catch (error) {
                    console.error('Error di priceManager.handlePriceCommand:', error);
                }

                try {
                    pendingOrder.handlePendingMessage(sock, m);
                } catch (error) {
                    console.error('Error di pendingOrder.handlePendingMessage:', error);
                }
            }
        });
    } catch (error) {
        console.error('Error saat menghubungkan ke WhatsApp:', error);
        setTimeout(connectToWhatsApp, 5000);
    }
}

connectToWhatsApp();
