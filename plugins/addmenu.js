const fs = require('fs');
const path = require('path');

module.exports = async (chiwa, m, isRegistered, text, isOwner, command) => {
    if (!isOwner) return m.reply("Khusus Owner");
    if (!text) return m.reply("Masukkan kategori yang ingin ditambahkan");
    
    const category = text.trim();
    if (!category) return m.reply("Format salah! Masukkan kategori yang valid.");
    
    const filePath = path.join(__dirname, '../database/menu.json');
    let menuData = {};
    
    try {
        if (fs.existsSync(filePath)) {
            menuData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (err) {
        console.error(err);
    }
    
    if (!menuData[category]) {
        menuData[category] = {};
    } else {
        return m.reply("Kategori sudah ada.");
    }
    
    try {
        fs.writeFileSync(filePath, JSON.stringify(menuData, null, 2));
        m.reply(`Kategori '${category}' berhasil ditambahkan.`);
    } catch (err) {
        console.error(err);
    }
};
