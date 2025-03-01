
module.exports = async (chiwa, m, isRegistered, text, isOwner, command) => {
    try {
        await m.reply(`Halooww, kalaw maw chat customer service hubungi kontak dibawah yaw`)
        await chiwa.sendContact(m.chat, ['6281455124049'], m);
    } catch (error) {
        console.error(error)
    }
};
