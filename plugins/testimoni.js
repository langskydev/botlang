module.exports = async (chiwa, m, isRegistered, text, isOwner, command) => {
    try {
      // Kirim pesan dengan link testimoni
      const testimoniLink = "https://drive.google.com/drive/mobile/folders/1eiKwMRAIBEEP5ruvisvz6obf5KYSgVgI?fbclid=PAY2xjawIwGotleHRuA2FlbQIxMAABpu-APIJ3V9fUaSl8C6dqnYSNTfOqdxPWX2-NjvQa_QSoPAAvkP6d4tQp9Q_aem_sMg-idZjorvlrIpnZcm3jA"; // ganti dengan link yang diinginkan
      await m.reply(`Halooww, silakan klik link berikut untuk testimoni:\n\n${testimoniLink}`);
    } catch (error) {
      console.error(error);
    }
  };
  