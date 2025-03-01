module.exports = async (chiwa, m, isRegistered, text, isOwner, command, prefix) => {
    try{
    await chiwa.sendButtonMsg(m.chat, { text: 'halo', footer: 'apalah', buttons: [
        {
          buttonId: prefix + "owner",
          buttonText: { displayText: "Owner" },
          type: 1
        },
        {
          buttonId: prefix + "creator",
          buttonText: { displayText: "Creator" },
          type: 1
        },
        {
          buttonId: "listbtns",
          buttonText: { displayText: "Lorem" },
          nativeFlowInfo: {
            name: "single_select",
            paramsJson: JSON.stringify({
              title: "Lorem Ipsum",
              sections: [
                {
                  title: "<Title/>",
                  highlight_label: "<Label/>",
                  rows: [
                    {
                      header: "header",
                      title: "title",
                      description: "description",
                      id: "id"
                    },
                    {
                      header: "header",
                      title: "title",
                      description: "description",
                      id: "id"
                    }
                  ]
                }
              ]
            })
          },
          type: 2
        },
        {
          buttonId: "btns",
          buttonText: { displayText: "Dolor sit amet" },
          nativeFlowInfo: {
            name: "cta_url",
            paramsJson: JSON.stringify({
              display_text: "Dolor sit amet",
              url: "https://www.google.com",
              merchant_url: "https://www.google.com"
            })
          },
          type: 2
        }
      ]}, { quoted: m })
    
    } catch(e){
        console.error(e)
    }
      
};