const { proto, delay, getContentType, } = require('@whiskeysockets/baileys')
/**
 * Serialize Message
 * @param {WAConnection} conn 
 * @param {Object} m 
 * @param {store} store 
 */

function getTypeMessage(message) {
	const type = Object.keys(message)
		var restype =  (!['senderKeyDistributionMessage', 'messageContextInfo'].includes(type[0]) && type[0]) || // Sometimes message in the front
				(type.length >= 3 && type[1] !== 'messageContextInfo' && type[1]) || // Sometimes message in midle if mtype length is greater than or equal to 3
				type[type.length - 1] || Object.keys(message)[0] // common case
return restype
}
exports.messageParser = (conn, m, store) => {
    if (!m) return m
    let M = proto.WebMessageInfo
    var m = M.fromObject(m)
    if (m.key) {
        m.id = m.key.id
        m.isBaileys = m.id.startsWith('BAE5') && m.id.length === 16
        m.chat = m.key.remoteJid
        m.fromMe = m.key.fromMe
        m.isGroup = m.chat.endsWith('@g.us')
        m.sender = conn.decodeJid(m.fromMe && conn.user.id || m.participant || m.key.participant || m.chat || '')
        if (m.isGroup) m.participant = conn.decodeJid(m.key.participant) || ''
    }
	if (m.message) {
		m.mtype = getTypeMessage(m.message)
		m.msg = (m.mtype == 'viewOnceMessage' ? m.message[m.mtype].message[getTypeMessage(m.message[m.mtype].message)] : m.message[m.mtype])
//		m.body = m.message.conversation || m.msg.caption || m.msg.text || (m.mtype == 'listResponseMessage') && m.msg.singleSelectReply.selectedRowId || (m.mtype == 'buttonsResponseMessage') && m.msg.selectedButtonId || (m.mtype == 'viewOnceMessage') && m.msg.caption || m.tex // (m.mtype === 'conversation' && m.message.conversation) ? m.message.conversation : (m.mtype == 'imageMessage') && m.message.imageMessage.caption ? m.message.imageMessage.caption : (type == 'videoMessage') && m.message.videoMessage.caption ? m.message.videoMessage.caption : (m.mtype == 'extendedTextMessage') && m.message.extendedTextMessage.text ? m.message.extendedTextMessage.text : (m.mtype == 'listResponseMessage') && m.message.listResponseMessage.singleSelectReply.selectedRowId ? m.message.listResponseMessage.singleSelectReply.selectedRowId : (m.mtype == 'buttonsResponseMessage') && m.message.buttonsResponseMessage.selectedButtonId ? m.message.buttonsResponseMessage.selectedButtonId : (m.mtype == 'templateButtonReplyMessage') && m.message.templateButtonReplyMessage.selectedId ? m.message.templateButtonReplyMessage.selectedId : ''
		
		try {
			m.body =
				m.message.conversation ||
				m.message[m.type].text ||
				m.message[m.type].caption ||
				(m.type === "listResponseMessage" && m.message[m.type].singleSelectReply.selectedRowId) ||
				(m.type === "buttonsResponseMessage" &&
					m.message[m.type].selectedButtonId) ||
				(m.type === "templateButtonReplyMessage" && m.message[m.type].selectedId) ||
				"";
		} catch {
			m.body = "";
		}
		
		
		
		// t
		let quoted = m.quoted = m.msg.contextInfo ? m.msg.contextInfo.quotedMessage : null
		//m.mentionedJid = m.msg.contextInfo ? m.msg.contextInfo.mentionedJid : []
		m.mentionedJid = m.msg.contextInfo ? m.msg.contextInfo.mentionedJid : []
		if (m.quoted) {
			let type = Object.keys(quoted)[0]
			m.quoted = m.quoted[type]
			if (['productMessage'].includes(type)) {
				type = getContentType(m.quoted)
				m.quoted = m.quoted[type]
			}
			if (typeof m.quoted === 'string') m.quoted = {
				text: m.quoted
			}
			m.quoted.mtype = type
			m.quoted.id = m.msg.contextInfo.stanzaId
			m.quoted.chat = m.msg.contextInfo.remoteJid || m.chat
			m.quoted.isBaileys = m.quoted.id ? m.quoted.id.startsWith('BAE5') && m.quoted.id.length === 16 : false
			m.quoted.sender = conn.decodeJid(m.msg.contextInfo.participant)
			m.quoted.fromMe = m.quoted.sender === (conn.user && conn.user.jid)
			m.quoted.text = m.quoted.text || m.quoted.caption || m.quoted.conversation || m.quoted.contentText || m.quoted.selectedDisplayText || m.quoted.title || ''
			m.quoted.mentionedJid = m.quoted.contextInfo ? m.quoted.contextInfo.mentionedJid : []
			m.getQuotedObj = m.getQuotedMessage = async () => {
				if (!m.quoted.id) return false
				let q = await store.loadMessage(m.chat, m.quoted.id, conn)
				return exports.smsg(conn, q, store)
			}
			let vM = m.quoted.fakeObj = M.fromObject({
				key: {
					remoteJid: m.quoted.chat,
					fromMe: m.quoted.fromMe,
					id: m.quoted.id
				},
				message: quoted,
				...(m.isGroup ? {
					participant: m.quoted.sender
				} : {})
			})

			/**
			 * 
			 * @returns 
			 */
			m.quoted.delete = () => conn.sendMessage(m.quoted.chat, {
				delete: vM.key
			})

			/**
			 * 
			 * @param {*} jid 
			 * @param {*} forceForward 
			 * @param {*} options 
			 * @returns 
			 */
			m.quoted.copyNForward = (jid, forceForward = false, options = {}) => conn.copyNForward(jid, vM, forceForward, options)

			/**
			 *
			 * @returns
			 */
			m.quoted.download = () => conn.downloadMediaMessage(m.quoted)
		}
	}
    if (m.msg.url) m.download = () => conn.downloadMediaMessage(m.msg)
    m.text = m.msg.text || m.msg.caption || m.message.conversation || m.msg.contentText || m.msg.selectedDisplayText || m.msg.title || ''
    /**
	* Reply to this message
	* @param {String|Object} text 
	* @param {String|false} chatId 
	* @param {Object} options 
	*/
    m.reply = (text, chatId = m.chat, options = {}) => Buffer.isBuffer(text) ? conn.sendMedia(chatId, text, 'file', '', m, { ...options }) : conn.sendText(chatId, text, m, { ...options })
    /**
	* Copy this message
	*/
	m.copy = () => exports.smsg(conn, M.fromObject(M.toObject(m)))

	/**
	 * 
	 * @param {*} jid 
	 * @param {*} forceForward 
	 * @param {*} options 
	 * @returns 
	 */
	m.copyNForward = (jid = m.chat, forceForward = false, options = {}) => conn.copyNForward(jid, m, forceForward, options)

    return m
}