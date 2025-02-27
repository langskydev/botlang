// /src/backup.js
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// Tentukan path file sumber dan direktori backup
const sourceFile = path.join(__dirname, '../database/listproduct/data.json');
const backupDir = path.join(__dirname, '../database/backup/listproduct');
const backupFile = path.join(backupDir, 'data_backup.json');

// Fungsi untuk melakukan backup
function backupFileFunction() {
  try {
    // Pastikan direktori backup ada, jika tidak, buat secara rekursif
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    // Jika file backup lama ada, hapus terlebih dahulu
    if (fs.existsSync(backupFile)) {
      fs.unlinkSync(backupFile);
    }
    // Salin file data.json ke lokasi backup
    fs.copyFileSync(sourceFile, backupFile);
    console.log(`Backup berhasil: ${backupFile}`);
  } catch (error) {
    console.error('Backup gagal:', error);
  }
}

// Jadwalkan backup setiap hari pada pukul 12:18
cron.schedule('00 00 * * *', () => {
  console.log('Memulai proses backup...');
  backupFileFunction();
});
