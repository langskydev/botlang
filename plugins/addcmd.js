const fs = require('fs');
const path = require('path');

module.exports = async (chiwa, m, isRegistered, text, isOwner, command) => {
    if (!isOwner) return m.reply("Khusus Owner");
    if (!text) return m.reply("Masukkan kategori dan nama command yang ingin ditambahkan (format: kategori|command)");
    
    const [category, cmdName] = text.split('|').map(t => t.trim());
    if (!category || !cmdName) return m.reply("Format salah! Gunakan: kategori|command");
    
    const filePath = path.join(__dirname, '../database/menu.json');
    let menuData = {};
    
    try {
        if (fs.existsSync(filePath)) {
            menuData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (err) {
        return m.reply("Terjadi kesalahan dalam membaca file menu.json");
    }
    
    if (!menuData[category]) {
        return m.reply("Kategori tidak ditemukan.");
    }
    
    for (const cat in menuData) {
        if (menuData[cat][cmdName]) {
            return m.reply("Command sudah ada di kategori lain atau sebagai alias.");
        }
    }
    
    menuData[category][cmdName] = {
        alias: []
    };
    
    try {
        fs.writeFileSync(filePath, JSON.stringify(menuData, null, 2));
        
        const cmdFilePath = path.join(__dirname, `./${cmdName}.js`);
        if (fs.existsSync(cmdFilePath)) {
            return m.reply("Command sudah ada sebagai file.");
        }
        
        const cmdTemplate = `module.exports = async (chiwa, m, isRegistered, text, isOwner, command) => {\n\n    m.reply('command ini belum memiliki fungsi apapun') \n};`;
        
        fs.writeFileSync(cmdFilePath, cmdTemplate);
        
        m.reply(`Command '${cmdName}' berhasil ditambahkan ke kategori '${category}' dan file '${cmdName}.js' telah dibuat.`);
        let chi = require.resolve('../database/menu.json');
        delete require.cache[chi];
    } catch (err) {
        m.reply("Terjadi kesalahan dalam menyimpan data.");
    }
};
