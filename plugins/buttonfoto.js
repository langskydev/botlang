
module.exports = async (chiwa, m, isRegistered, text, isOwner, command, prefix) => {
    try{
        await chiwa.sendButtonMsg(m.chat, {
            text: "Pilih salah satu tombol di bawah!",
            footer: "Footer text",
            image: { url: "https://res.cloudinary.com/dk3cknvmu/image/upload/f_auto,q_auto/w6yaci3mdwotbgxvb0mw" }, 
            buttons: [
                { buttonId: "id1", buttonText: { displayText: "Tombol 1" }, type: 1 },
                { buttonId: "id2", buttonText: { displayText: "Tombol 2" }, type: 1 }
            ]
        });
    
    } catch(e){
        console.error(e)
    }
      
};