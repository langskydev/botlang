const fs = require('fs');
const path = require('path');

const menuPath = path.join(__dirname, '../database/menu.json');

module.exports = async (chiwa, m, isRegistered, text, isOwner, command) => {
    if (!isOwner) return m.reply('Perintah ini hanya bisa digunakan oleh owner');
    
    const [alias, commandName] = text.split('|').map(s => s.trim());
    if (!alias || !commandName) return m.reply(`
Untuk menghapus alias perintah, gunakan format berikut:

${process.env.PREFIX + command} \`alias\`|\`command\`
    `);
    
    try {
        let menu = JSON.parse(fs.readFileSync(menuPath, 'utf-8'));
        let commandFound = false;
        for (const category in menu) {
            if (menu[category][commandName]) {
                commandFound = true;
                const aliasIndex = menu[category][commandName].alias.indexOf(alias);
                if (aliasIndex === -1) {
                    return m.reply('Alias ini tidak ditemukan untuk perintah tersebut!');
                }
                
                menu[category][commandName].alias.splice(aliasIndex, 1);
                fs.writeFileSync(menuPath, JSON.stringify(menu, null, 2));
                return m.reply('Alias perintah berhasil dihapus!');
            }
        }
        
        if (!commandFound) {
            return m.reply('Tidak ditemukan alias pada command tersebut!');
        }
    } catch (err) {
        console.error(err);
    }
};