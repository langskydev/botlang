const { makeWASocket,jidDecode, useMultiFileAuthState,downloadContentFromMessage, DisconnectReason,generateWAMessageFromContent,generateWAMessageContent, makeInMemoryStore, proto } = require("@whiskeysockets/baileys")
const readline = require('readline')
const question = (text) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); return new Promise((resolve) => { rl.question(text, resolve) }) };
const pino = require('pino')
const packageJson = require('./package.json');
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const FileType = require('file-type')
const path = require('path')
const { messageParser }  = require('./lib/parser')
const chalk = require('chalk')
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) })
const dotenv = require('dotenv')
require('dotenv').config()
const PhoneNumber = require('awesome-phonenumber')
async function startBot(){
    await fs.promises.mkdir('temp', { recursive: true })
    const { state, saveCreds } = await useMultiFileAuthState("session")
    const chiwa = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: state,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: true,
        fireInitQueries: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: true,
        markOnlineOnConnect: true,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        });

    if(!chiwa.authState.creds.registered){
        console.log(chalk.blue('Masukkan nomot telepon diawali kode negara: '))
        const nomer = await question("")
        const kode = await chiwa.requestPairingCode(nomer)
        console.log(`Kode Pairing Kamu ${kode}`)
    }
    chiwa.ev.on('creds.update', await saveCreds)
    chiwa.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect} = update
        if (connection === 'close') {
          let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      
          switch (reason) {
              case DisconnectReason.badSession:
                  console.log(`Bad Session File, Please Delete Session and Scan Again`);
                  chiwa.logout();
                  break;
              case DisconnectReason.connectionClosed:
                  console.log("Connection closed, reconnecting....");
                  startBot();
                  break;
              case DisconnectReason.connectionLost:
                  console.log("Connection Lost from Server, reconnecting...");
                  startBot();
                  break;
              case DisconnectReason.connectionReplaced:
                  console.log("Connection Replaced, Another New Session Opened, Please Close Current Session First");
                  chiwa.logout();
                  break;
              case DisconnectReason.loggedOut:
                  console.log(`Device Logged Out, Please Scan Again And Run.`);
                  chiwa.logout();
                  break;
              case DisconnectReason.restartRequired:
                  console.log("Restart Required, Restarting...");
                  startBot();
                  break;
              default:
                  console.log("Unknown disconnection reason, attempting to reconnect...");
                  startBot();
          }
      }


let ModuleLoaded = false;

if (connection === 'open' && !ModuleLoaded) {
    console.log(`[ TERHUBUNG ] Welcome owner ${chiwa.user.name}`);
}

    })

chiwa.getFile = async (PATH, returnAsFilename) => {
let res, filename
let data = Buffer.isBuffer(PATH) ? PATH : /^data:.*?\/.*?;base64,/i.test(PATH) ? Buffer.from(PATH.split`,`[1], 'base64') : /^https?:\/\//.test(PATH) ? await (res = await fetch(PATH)).buffer() : fs.existsSync(PATH) ? (filename = PATH, fs.readFileSync(PATH)) : typeof PATH === 'string' ? PATH : Buffer.alloc(0)
if (!Buffer.isBuffer(data)) throw new TypeError('Result is not a buffer')
let type = await FileType.fromBuffer(data) || {
mime: 'application/octet-stream',
ext: '.bin'
}
if (data && returnAsFilename && !filename)(filename = path.join(__dirname, './temp/' + new Date * 1 + '.' + type.ext), await fs.promises.writeFile(filename, data))
return {
res,
filename,
...type,
data
}
}
chiwa.downloadMediaMessage = async (message) => {
let mime = (message.msg || message).mimetype || ''
let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
const stream = await downloadContentFromMessage(message, messageType)
let buffer = Buffer.from([])
for await(const chunk of stream) {
buffer = Buffer.concat([buffer, chunk])
}

return buffer
} 
chiwa.sendButtonMsg = async (jid, content = {}, options = {}) => {
    const { text, caption, footer = '', headerType = 1, ai, contextInfo = {}, buttons = [], mentions = [], ...media } = content;
    const msg = await generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2,
                },
                buttonsMessage: {
                    ...(media && typeof media === 'object' && Object.keys(media).length > 0 ? await generateWAMessageContent(media, {
                        upload: chiwa.waUploadToServer
                    }) : {}),
                    contentText: text || caption || '',
                    footerText: footer,
                    buttons,
                    headerType: media && Object.keys(media).length > 0 ? Math.max(...Object.keys(media).map((a) => ({ document: 3, image: 4, video: 5, location: 6 })[a] || headerType)) : headerType,
                    contextInfo: {
                        ...contextInfo,
                        ...options.contextInfo,
                        mentionedJid: options.mentions || mentions,
                        ...(options.quoted ? {
                            stanzaId: options.quoted.key.id,
                            remoteJid: options.quoted.key.remoteJid,
                            participant: options.quoted.key.participant || options.quoted.key.remoteJid,
                            fromMe: options.quoted.key.fromMe,
                            quotedMessage: options.quoted.message
                        } : {})
                    }
                }
            }
        }
    }, {});
    const hasil = await chiwa.relayMessage(msg.key.remoteJid, msg.message, {
        messageId: msg.key.id,
        additionalNodes: [{
            tag: 'biz',
            attrs: {},
            content: [{
                tag: 'interactive',
                attrs: {
                    type: 'native_flow',
                    v: '1'
                },
                content: [{
                    tag: 'native_flow',
                    attrs: {
                        name: 'quick_reply'
                    }
                }]
            }]
        }, ...(ai ? [{ attrs: { biz_bot: '1' }, tag: 'bot' }] : [])]
    })
    return  msg
}

chiwa.sendFile = async (jid, path, filename = '', caption = '', quoted, ptt = false, options = {}) => {
let type = await chiwa.getFile(path, true)
let {
res,
data: file,
filename: pathFile
} = type
if (res && res.status !== 200 || file.length <= 65536) {
try {
throw {
json: JSON.parse(file.toString())
}
}
catch (e) {
if (e.json) throw e.json
}
}
let opt = {
filename
}
if (quoted) opt.quoted = quoted
if (!type) options.asDocument = true
let mtype = '',
mimetype = type.mime,
convert
if (/webp/.test(type.mime) || (/image/.test(type.mime) && options.asSticker)) mtype = 'sticker'
else if (/image/.test(type.mime) || (/webp/.test(type.mime) && options.asImage)) mtype = 'image'
else if (/video/.test(type.mime)) mtype = 'video'
else if (/audio/.test(type.mime))(
convert = await toAudio(file, type.ext),
file = convert.data,
pathFile = convert.filename,
mtype = 'audio',
mimetype = 'audio/ogg; codecs=opus'
)
else mtype = 'document'
if (options.asDocument) mtype = 'document'

delete options.asSticker
delete options.asLocation
delete options.asVideo
delete options.asDocument
delete options.asImage

let message = {
...options,
caption,
ptt,
[mtype]: {
url: pathFile
},
mimetype,
fileName: filename || pathFile.split('/').pop()
}
let m
try {
 m = await chiwa.sendMessage(jid, message, {
...opt,
...options
})
}
catch (e) {
//console.error(e)
m = null
}
finally {
if (!m) m = await chiwa.sendMessage(jid, {
...message,
[mtype]: file
}, {
...opt,
...options
})
file = null
return m
}
}





chiwa.getName = (jid, withoutContact = false) => {
id = chiwa.decodeJid(jid)
withoutContact = chiwa.withoutContact || withoutContact 
let v
if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
v = store.contacts[id] || {}
if (!(v.name || v.subject)) v = chiwa.groupMetadata(id) || {}
resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
})
else v = id === '0@s.whatsapp.net' ? {
id,
name: 'WhatsApp'
} : id === chiwa.decodeJid(chiwa.user.id) ?
chiwa.user :
(store.contacts[id] || {})
return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
}

chiwa.sendContact = async (jid, kon, quoted = '', opts = {}) => {
let list = []
for (let i of kon) {
list.push({
displayName: await chiwa.getName(i + '@s.whatsapp.net'),
vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${await chiwa.getName(i + '@s.whatsapp.net')}\nFN:${await chiwa.getName(i + '@s.whatsapp.net')}\nitem1.TEL;waid=${i}:${i}\nitem1.X-ABLabel:Ponsel\nitem2.EMAIL;type=INTERNET:${setting.gmail}\nitem2.X-ABLabel:Email\nitem3.URL:${setting.website}\nitem3.X-ABLabel:Instagram\nitem4.ADR:;;Indonesia;;;;\nitem4.X-ABLabel:Region\nEND:VCARD`
})
}
chiwa.sendMessage(jid, { contacts: { displayName: `${list.length} Kontak`, contacts: list }, ...opts }, { quoted })
}
chiwa.sendContact = async (jid, kon, quoted = '', opts = {}) => {
let list = []
for (let i of kon) {
list.push({
displayName: await chiwa.getName(i + '@s.whatsapp.net'),
vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${await chiwa.getName(i + '@s.whatsapp.net')}\nFN:${await chiwa.getName(i + '@s.whatsapp.net')}\nitem1.TEL;waid=${i}:${i}\nitem1.X-ABLabel:Ponsel\nitem2.EMAIL;type=INTERNET:kawaii@chiwa.id\nitem2.X-ABLabel:Email\nitem3.URL:https://chiwa.id\nitem3.X-ABLabel:Instagram\nitem4.ADR:;;Indonesia;;;;\nitem4.X-ABLabel:Region\nEND:VCARD`
})
}
chiwa.sendMessage(jid, { contacts: { displayName: `${list.length} Kontak`, contacts: list }, ...opts }, { quoted })
}
chiwa.decodeJid = (jid) => {
        if (!jid) return jid
        if (/:\d+@/gi.test(jid)) {
        let decode = jidDecode(jid) || {}
        return decode.user && decode.server && decode.user + '@' + decode.server || jid
        } else return jid
        }
chiwa.sendText = (jid, text, quoted = '', options) => chiwa.sendMessage(jid, { text: text, ...options }, { quoted, ...options })
chiwa.sendMedia = async (jid, path, fileName = '', caption = '', quoted = '', options = {}) => {
let types = await chiwa.getFile(path, true)
let { mime, ext, res, data, filename } = types
if (res && res.status !== 200 || file.length <= 65536) {
try { throw { json: JSON.parse(file.toString()) } }
catch (e) { if (e.json) throw e.json }
}
let type = '', mimetype = mime, pathFile = filename
if (options.asDocument) type = 'document'
if (options.asSticker || /webp/.test(mime)) {
let media = { mimetype: mime, data }
pathFile = await writeExif(media, { packname: options.packname ? options.packname : global.packname, author: options.author ? options.author : global.author, categories: options.categories ? options.categories : [] })
await fs.promises.unlink(filename)
type = 'sticker'
mimetype = 'image/webp'
}
else if (/image/.test(mime)) type = 'image'
else if (/video/.test(mime)) type = 'video'
else if (/audio/.test(mime)) type = 'audio'
else type = 'document'
await chiwa.sendMessage(jid, { [type]: { url: pathFile }, caption, mimetype, fileName, ...options }, { quoted, ...options })
return fs.promises.unlink(pathFile)
}

chiwa.ev.on('messages.upsert', async chatUpdate => {
    try {
    for (let messages of chatUpdate.messages) {
    if (!messages.message) return
    messages.message = (Object.keys(messages.message)[0] === 'ephemeralMessage') ? messages.message.ephemeralMessage.message : messages.message
    if (messages.key && messages.key.remoteJid === 'status@broadcast') return
    if (messages.key.id.startsWith('BAE5') && messages.key.id.length === 16) return
    const m = messageParser(chiwa, messages, store)
    require("./chiww")(chiwa, m, chatUpdate, messages, store)
    }
    } catch (err) {
    console.log(err)
    }
    })

chiwa.ev.on('contacts.update', update => {
for (let contact of update) {
let id = chiwa.decodeJid(contact.id)
if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
}
})
}

startBot()
