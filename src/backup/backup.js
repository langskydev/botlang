const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// Direktori utama database (folder "database" berada di root proyek)
const databaseDir = path.join(__dirname, '../../database');

// Jadwalkan backup setiap hari pada pukul 00:00 (cron format: "menit jam * * *")
cron.schedule('0 0 * * *', () => {
    console.log('Melakukan backup pada pukul 00:00');
    
    // Pastikan folder database ada
    if (!fs.existsSync(databaseDir)) {
        console.error(`Folder database tidak ditemukan di ${databaseDir}`);
        return;
    }
    
    // Backup untuk setiap produk (subfolder di dalam database)
    const products = fs.readdirSync(databaseDir, { withFileTypes: true })
        .filter(item => item.isDirectory() && item.name !== 'backup') // kecuali folder backup
        .map(item => item.name);
        
    products.forEach(product => {
        const productDir = path.join(databaseDir, product);
        const priceFile = path.join(productDir, 'price.json');
        const backupFile = path.join(productDir, 'backup.json');
        
        // Lakukan backup hanya jika file price.json ada
        if (fs.existsSync(priceFile)) {
            // Jika backup sudah ada, hapus terlebih dahulu
            if (fs.existsSync(backupFile)) {
                fs.unlinkSync(backupFile);
            }
            
            // Salin isi file price.json ke file backup.json
            const data = fs.readFileSync(priceFile, 'utf8');
            fs.writeFileSync(backupFile, data, 'utf8');
            console.log(`Backup untuk produk "${product}" berhasil disimpan di ${backupFile}`);
        } else {
            console.log(`Tidak ditemukan file price.json untuk produk "${product}", backup dilewati.`);
        }
    });

    // Backup untuk forbiddenWords.json
    const forbiddenFile = path.join(databaseDir, 'forbiddenWords.json');
    const backupDir = path.join(databaseDir, 'backup');
    
    // Pastikan folder backup ada
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const forbiddenBackupFile = path.join(backupDir, 'forbiddenWords_backup.json');
    if (fs.existsSync(forbiddenFile)) {
        fs.copyFileSync(forbiddenFile, forbiddenBackupFile);
        console.log(`Backup forbiddenWords.json berhasil disimpan di ${forbiddenBackupFile}`);
    } else {
        console.log('File forbiddenWords.json tidak ditemukan, backup dilewati.');
    }
});
