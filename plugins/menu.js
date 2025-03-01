
const fs = require('fs');
const more = String.fromCharCode(8206)
const readmore = more.repeat(4001)
function formatRupiah(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR'
    }).format(Number(amount));
}

const formatDate = (date) => {
    return new Intl.DateTimeFormat('id-ID', { 
        timeZone: 'Asia/Jakarta', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
    }).format(new Date(date));
};

module.exports = async (chiwa, m, isRegistered, text, isOwner, command, prefix) => {
    try {
        const menuData = JSON.parse(fs.readFileSync('database/menu.json', 'utf8'));

        let sections = [];
        for (const [category, commands] of Object.entries(menuData)) {
            let rows = [];
            for (const [command, details] of Object.entries(commands)) {
                rows.push({
                    header: category,
                    title: `${prefix}${command}`,
                    description: details.alias.length > 0 ? `Alias: ${details.alias.join(', ')}` : '',
                    id: `${prefix}${command}`
                });
            }
            sections.push({
                title: category.toUpperCase(),
                highlight_label: "Pilih menu",
                rows
            });
        }

        let buttons = [
            {
                buttonId: "list_menu",
                buttonText: { displayText: "📜 Kategori" },
                nativeFlowInfo: {
                    name: "single_select",
                    paramsJson: JSON.stringify({ title: "Kategori", sections })
                },
                type: 2
            },
            {
                buttonId: `${prefix}owner`,
                buttonText: { displayText: "Owner" },
                type: 1
              },
              {
                buttonId: prefix+"cs",
                buttonText: { displayText: "Customer Service" },
                type: 1
              },
        ];
let menuText = `╔┈┈┈┈「 INFO STORE 」┈┈┈┈✧
╎╭─────────────────✧
╎│Halo kak ${m.pushName}
╎│𖣘• Nama : ${m.pushName}
╎╰─────────────────✧
╚┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈✧
${readmore}
`;
const formatMenu = (menuObj, title) => {
    let menuText = `╔┈┈┈┈「 ${title} 」┈┈┈┈✧\n╎╭─────────────────✧\n`;
    for (const [command, details] of Object.entries(menuObj)) {
        const aliasText = details.alias.length > 0 ? `/${details.alias.join('/')}` : '';  
        menuText += `╎│❐ ${prefix+command}${aliasText}\n`;
    }
    menuText += "╎╰─────────────────✧\n╚┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈✧\n";
    return menuText;
};
        for (const [category, commands] of Object.entries(menuData)) {
            menuText += formatMenu(commands, category.toUpperCase()); 
        }
if (process.env.USE_BUTTON === 'true'){
        await chiwa.sendButtonMsg(m.chat, {
            text: `SELAMAT DATANG DI CAKSTORE
👑+-----+------+------+------+-----+👑
KETIK ANGKA 1-9 UNTUK MENAMPILKAN PILIHAN ANDA✅

1️⃣. NETFLIX
2️⃣. VIDIO
3️⃣. VIU
4️⃣. WETV
5️⃣. AMAZON PRIME VIDIO
6️⃣. IQIYI
7️⃣. PEMBAYARAN
8️⃣. PERBEDAAN NETFLIX
9️⃣. HUBUNGI CS
`,
            footer: "Silakan pilih kategori menu di bawah",
            buttons
        }, { quoted: m });
    } else {
        m.reply(`SELAMAT DATANG DI CAKSTORE
👑+-----+------+------+------+-----+👑
KETIK ANGKA 1-9 UNTUK MENAMPILKAN PILIHAN ANDA✅

1️⃣. NETFLIX
2️⃣. VIDIO
3️⃣. VIU
4️⃣. WETV
5️⃣. AMAZON PRIME VIDIO
6️⃣. IQIYI
7️⃣. PEMBAYARAN
8️⃣. PERBEDAAN NETFLIX
9️⃣. HUBUNGI CS`)
    }
    } catch (e) {
        console.log(e);
        await m.reply(e.message);
    }
};
