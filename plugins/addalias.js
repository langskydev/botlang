const fs = require('fs');
const path = require('path');

const menuPath = path.join(__dirname, '../database/menu.json');

module.exports = async (chiwa, m, isRegistered, text, isOwner, command) => {
    if (!isOwner) return m.reply('Perintah ini hanya bisa digunakan oleh owner');
    
    const [alias, commandName] = text.split('|').map(s => s.trim());
    if (!alias || !commandName) return m.reply(`
Untuk menambahkan alias perintah, gunakan format berikut:

${process.env.PREFIX + command} \`alias\`|\`command asli\`

Contoh:
${process.env.PREFIX + command} deluser|deleteuser
    `);
    
    try {
        let menu = JSON.parse(fs.readFileSync(menuPath, 'utf-8'));

        for (const category in menu) {
            if (menu[category][alias]) {
                return m.reply(`Alias "${alias}" sudah digunakan sebagai perintah utama!`);
            }
        }

        let commandFound = false;
        let aliasExists = false;

        for (const category in menu) {
            for (const cmd in menu[category]) {
                if (cmd === commandName) {
                    commandFound = true;
                    if (menu[category][cmd].alias.includes(alias)) {
                        return m.reply('Alias sudah ditambahkan sebelumnya!');
                    }
                    menu[category][cmd].alias.push(alias);
                    fs.writeFileSync(menuPath, JSON.stringify(menu, null, 2));
                    let chi = require.resolve('../database/menu.json');
                    delete require.cache[chi];
                    return m.reply('Alias berhasil ditambahkan!');
                }

                if (menu[category][cmd].alias.includes(alias)) {
                    aliasExists = true;
                }
            }
        }

        if (aliasExists) {
            return m.reply(`Alias "${alias}" sudah digunakan sebagai alias di perintah lain!`);
        }

        if (!commandFound) {
            return m.reply('Perintah yang ingin diberi alias tidak ditemukan!');
        }
    } catch (err) {
        console.error(err);
    }
};
