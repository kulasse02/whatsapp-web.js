const express = require('express')
const routes = express.Router()
const swaggerUi = require('swagger-ui-express')
const swaggerDocument = require('../swagger.json')
const { enableLocalCallbackExample, enableSwaggerEndpoint } = require('./config')

const middleware = require('./middleware')
const healthController = require('./controllers/healthController')
const sessionController = require('./controllers/sessionController')
const clientController = require('./controllers/clientController')
const chatController = require('./controllers/chatController')
const groupChatController = require('./controllers/groupChatController')
const messageController = require('./controllers/messageController')
const contactController = require('./controllers/contactController')
const adminController = require('./controllers/adminController')
const catalogController = require('./controllers/catalogController')

/**
 * ================
 * HEALTH ENDPOINTS
 * ================
 */

// API endpoint to check if server is alive
routes.get('/ping', healthController.ping)
// API basic callback
if (enableLocalCallbackExample) {
  routes.post('/localCallbackExample', [middleware.apikey, middleware.rateLimiter], healthController.localCallbackExample)
}

/**
 * ================
 * SESSION ENDPOINTS
 * ================
 */
const sessionRouter = express.Router()

// Skip the entire session API router for frontend SPA routes like /session/:id/chat/...
// These paths don't match any backend action and should be served as index.html by the SPA wildcard handler
sessionRouter.use((req, res, next) => {
  const backendPrefixes = ['/start/', '/status/', '/qr/', '/restart/', '/disconnect/', '/terminate/']
  const backendExact = ['/list', '/terminateInactive', '/terminateAll']
  const isBackend = backendPrefixes.some(p => req.path.startsWith(p)) || backendExact.includes(req.path)
  if (!isBackend) {
    return next('router') // Eject from sessionRouter, fall through to next handler (SPA wildcard)
  }
  next()
})

sessionRouter.use(middleware.apikey)
sessionRouter.use(middleware.sessionOwnership)
sessionRouter.use(middleware.sessionSwagger)
routes.use('/session', sessionRouter)

sessionRouter.get('/start/:sessionId', middleware.sessionNameValidation, sessionController.startSession)
sessionRouter.get('/status/:sessionId', middleware.sessionNameValidation, sessionController.statusSession)
sessionRouter.get('/qr/:sessionId', middleware.sessionNameValidation, sessionController.sessionQrCode)
sessionRouter.get('/qr/:sessionId/image', middleware.sessionNameValidation, sessionController.sessionQrCodeImage)
sessionRouter.get('/restart/:sessionId', middleware.sessionNameValidation, sessionController.restartSession)
sessionRouter.get('/disconnect/:sessionId', middleware.sessionNameValidation, sessionController.disconnectSession)
sessionRouter.get('/terminate/:sessionId', middleware.sessionNameValidation, sessionController.terminateSession)
sessionRouter.get('/terminateInactive', middleware.requireAdmin, sessionController.terminateInactiveSessions)
sessionRouter.get('/terminateAll', middleware.requireAdmin, sessionController.terminateAllSessions)
sessionRouter.get('/list', sessionController.listSessions)

/**
 * ================
 * CLIENT ENDPOINTS
 * ================
 */

const clientRouter = express.Router()
clientRouter.use(middleware.apikey)
clientRouter.use(middleware.sessionOwnership)
clientRouter.use(middleware.clientSwagger)
routes.use('/client', clientRouter)

clientRouter.get('/getClassInfo/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getClassInfo)
clientRouter.post('/acceptInvite/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.acceptInvite)
clientRouter.post('/archiveChat/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.archiveChat)
clientRouter.post('/createGroup/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.createGroup)
clientRouter.post('/getBlockedContacts/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getBlockedContacts)
clientRouter.post('/getChatById/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getChatById)
clientRouter.post('/getChatLabels/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getChatLabels)
clientRouter.get('/getChats/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getChats)
clientRouter.post('/getChatsByLabelId/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getChatsByLabelId)
clientRouter.post('/getCommonGroups/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getCommonGroups)
clientRouter.post('/getContactById/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getContactById)
clientRouter.get('/getContacts/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getContacts)
clientRouter.post('/getInviteInfo/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getInviteInfo)
clientRouter.post('/getLabelById/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getLabelById)
clientRouter.post('/getLabels/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getLabels)
clientRouter.post('/addOrRemoveLabels/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.addOrRemoveLabels)
clientRouter.post('/getNumberId/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getNumberId)
clientRouter.post('/isRegisteredUser/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.isRegisteredUser)
clientRouter.post('/getProfilePicUrl/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getProfilePictureUrl)
clientRouter.get('/getState/:sessionId', [middleware.sessionNameValidation], clientController.getState)
clientRouter.post('/markChatUnread/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.markChatUnread)
clientRouter.post('/muteChat/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.muteChat)
clientRouter.post('/pinChat/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.pinChat)
clientRouter.post('/searchMessages/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.searchMessages)
clientRouter.post('/sendMessage/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.sendMessage)
clientRouter.post('/sendPresenceAvailable/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.sendPresenceAvailable)
clientRouter.post('/sendPresenceUnavailable/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.sendPresenceUnavailable)
clientRouter.post('/sendSeen/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.sendSeen)
clientRouter.post('/setDisplayName/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.setDisplayName)
clientRouter.post('/setProfilePicture/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.setProfilePicture)
clientRouter.post('/setStatus/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.setStatus)
clientRouter.post('/unarchiveChat/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.unarchiveChat)
clientRouter.post('/unmuteChat/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.unmuteChat)
clientRouter.post('/unpinChat/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.unpinChat)
clientRouter.get('/getWWebVersion/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getWWebVersion)

clientRouter.post('/getContactLidAndPhone/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getContactLidAndPhone)
clientRouter.post('/sendReaction/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.sendReaction)
clientRouter.post('/requestPairingCode/:sessionId', [middleware.sessionNameValidation, middleware.sessionExistenceValidation], clientController.requestPairingCode)
clientRouter.post('/cancelPairingCode/:sessionId', [middleware.sessionNameValidation, middleware.sessionExistenceValidation], clientController.cancelPairingCode)
clientRouter.get('/getChannels/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getChannels)
clientRouter.post('/getChannelByInviteCode/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getChannelByInviteCode)
clientRouter.post('/sendChannelAdminInvite/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.sendChannelAdminInvite)
clientRouter.post('/acceptChannelAdminInvite/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.acceptChannelAdminInvite)
clientRouter.post('/revokeChannelAdminInvite/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.revokeChannelAdminInvite)
clientRouter.post('/demoteChannelAdmin/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.demoteChannelAdmin)
clientRouter.post('/getMessageById/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getMessageById)
clientRouter.post('/getPinnedMessages/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getPinnedMessages)
clientRouter.post('/acceptGroupV4Invite/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.acceptGroupV4Invite)
clientRouter.post('/getFormattedNumber/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getFormattedNumber)
clientRouter.post('/getCountryCode/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getCountryCode)
clientRouter.get('/getBroadcasts/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getBroadcasts)

clientRouter.get('/catalog/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], catalogController.getCatalogs)
clientRouter.post('/catalog/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], catalogController.createCatalog)
clientRouter.put('/catalog/:sessionId/:id', [middleware.sessionNameValidation, middleware.sessionValidation], catalogController.updateCatalog)
clientRouter.delete('/catalog/:sessionId/:id', [middleware.sessionNameValidation, middleware.sessionValidation], catalogController.deleteCatalog)
clientRouter.post('/getBroadcastById/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getBroadcastById)
clientRouter.post('/revokeStatusMessage/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.revokeStatusMessage)
clientRouter.post('/getGroupMembershipRequests/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getGroupMembershipRequests)
clientRouter.post('/approveGroupMembershipRequests/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.approveGroupMembershipRequests)
clientRouter.post('/rejectGroupMembershipRequests/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.rejectGroupMembershipRequests)
clientRouter.post('/setAutoDownloadAudio/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.setAutoDownloadAudio)
clientRouter.post('/setAutoDownloadDocuments/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.setAutoDownloadDocuments)
clientRouter.post('/setAutoDownloadPhotos/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.setAutoDownloadPhotos)
clientRouter.post('/setAutoDownloadVideos/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.setAutoDownloadVideos)
clientRouter.post('/setBackgroundSync/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.setBackgroundSync)
clientRouter.post('/getContactDeviceCount/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getContactDeviceCount)
clientRouter.post('/syncHistory/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.syncHistory)
clientRouter.post('/createCallLink/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.createCallLink)
clientRouter.post('/sendResponseToScheduledEvent/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.sendResponseToScheduledEvent)
clientRouter.post('/saveOrEditAddressbookContact/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.saveOrEditAddressbookContact)
clientRouter.post('/deleteAddressbookContact/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.deleteAddressbookContact)
clientRouter.post('/addOrEditCustomerNote/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.addOrEditCustomerNote)
clientRouter.post('/getCustomerNote/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getCustomerNote)
clientRouter.post('/getPollVotes/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getPollVotes)
clientRouter.post('/deleteProfilePicture/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.deleteProfilePicture)
clientRouter.post('/createChannel/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.createChannel)
clientRouter.post('/subscribeToChannel/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.subscribeToChannel)
clientRouter.post('/unsubscribeFromChannel/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.unsubscribeFromChannel)
clientRouter.post('/transferChannelOwnership/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.transferChannelOwnership)
clientRouter.post('/searchChannels/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.searchChannels)
clientRouter.post('/deleteChannel/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.deleteChannel)
clientRouter.post('/setDeviceName/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.setDeviceName)
clientRouter.post('/resetState/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.resetState)
clientRouter.get('/debugContactNames/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.debugContactNames)
clientRouter.post('/sendReactionDirect/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.sendReactionDirect)
clientRouter.post('/getMessageReactions/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], clientController.getMessageReactions)


/**
 * ================
 * CHAT ENDPOINTS
 * ================
 */
const chatRouter = express.Router()
chatRouter.use(middleware.apikey)
chatRouter.use(middleware.sessionOwnership)
chatRouter.use(middleware.chatSwagger)
routes.use('/chat', chatRouter)

chatRouter.post('/getClassInfo/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.getClassInfo)
chatRouter.post('/clearMessages/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.clearMessages)
chatRouter.post('/clearState/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.clearState)
chatRouter.post('/delete/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.deleteChat)
chatRouter.post('/fetchMessages/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.fetchMessages)
chatRouter.post('/getContact/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.getContact)
chatRouter.post('/sendStateRecording/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.sendStateRecording)
chatRouter.post('/sendStateTyping/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.sendStateTyping)

chatRouter.post('/getLabels/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.getLabels)
chatRouter.post('/changeLabels/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.changeLabels)
chatRouter.post('/getPinnedMessages/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.getPinnedMessages)
chatRouter.post('/syncHistory/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.syncHistory)
chatRouter.post('/addOrEditCustomerNote/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.addOrEditCustomerNote)
chatRouter.post('/getCustomerNote/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.getCustomerNote)
chatRouter.get('/getMessages/:sessionId/:chatId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.getMessages)
chatRouter.get('/resolveChatId/:sessionId/:chatId', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.resolveChatId)
chatRouter.get('/getMessageMedia/:sessionId/:chatId/:msgWid', [middleware.sessionNameValidation, middleware.sessionValidation], chatController.getMessageMedia)


/**
 * ================
 * GROUP CHAT ENDPOINTS
 * ================
 */
const groupChatRouter = express.Router()
groupChatRouter.use(middleware.apikey)
groupChatRouter.use(middleware.sessionOwnership)
groupChatRouter.use(middleware.groupChatSwagger)
routes.use('/groupChat', groupChatRouter)

groupChatRouter.post('/getClassInfo/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.getClassInfo)
groupChatRouter.post('/addParticipants/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.addParticipants)
groupChatRouter.post('/demoteParticipants/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.demoteParticipants)
groupChatRouter.post('/getInviteCode/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.getInviteCode)
groupChatRouter.post('/leave/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.leave)
groupChatRouter.post('/promoteParticipants/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.promoteParticipants)
groupChatRouter.post('/removeParticipants/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.removeParticipants)
groupChatRouter.post('/revokeInvite/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.revokeInvite)
groupChatRouter.post('/setDescription/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.setDescription)
groupChatRouter.post('/setInfoAdminsOnly/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.setInfoAdminsOnly)
groupChatRouter.post('/setMessagesAdminsOnly/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.setMessagesAdminsOnly)
groupChatRouter.post('/setSubject/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.setSubject)
groupChatRouter.post('/setPicture/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.setPicture)
groupChatRouter.post('/deletePicture/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.deletePicture)

groupChatRouter.post('/setAddMembersAdminsOnly/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], groupChatController.setAddMembersAdminsOnly)


/**
 * ================
 * MESSAGE ENDPOINTS
 * ================
 */
const messageRouter = express.Router()
messageRouter.use(middleware.apikey)
messageRouter.use(middleware.sessionOwnership)
messageRouter.use(middleware.messageSwagger)
routes.use('/message', messageRouter)

messageRouter.post('/getClassInfo/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.getClassInfo)
messageRouter.post('/delete/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.deleteMessage)
messageRouter.post('/downloadMedia/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.downloadMedia)
messageRouter.post('/forward/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.forward)
messageRouter.post('/getInfo/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.getInfo)
messageRouter.post('/getMentions/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.getMentions)
messageRouter.post('/getOrder/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.getOrder)
messageRouter.post('/getPayment/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.getPayment)
messageRouter.post('/getQuotedMessage/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.getQuotedMessage)
messageRouter.post('/react/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.react)
messageRouter.post('/reply/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.reply)
messageRouter.post('/star/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.star)
messageRouter.post('/unstar/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.unstar)

messageRouter.post('/pinMessage/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.pinMessage)
messageRouter.post('/unpinMessage/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.unpinMessage)
messageRouter.post('/getReactions/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.getReactions)
messageRouter.post('/editMessage/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.editMessage)
messageRouter.post('/getGroupMentions/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.getGroupMentions)
messageRouter.post('/getPollVotes/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.getPollVotes)
messageRouter.post('/vote/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], messageController.vote)


/**
 * ================
 * MESSAGE ENDPOINTS
 * ================
 */
const contactRouter = express.Router()
contactRouter.use(middleware.apikey)
contactRouter.use(middleware.sessionOwnership)
contactRouter.use(middleware.contactSwagger)
routes.use('/contact', contactRouter)

contactRouter.post('/getClassInfo/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], contactController.getClassInfo)
contactRouter.post('/block/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], contactController.block)
contactRouter.post('/getAbout/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], contactController.getAbout)
contactRouter.post('/getChat/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], contactController.getChat)
contactRouter.post('/unblock/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], contactController.unblock)
contactRouter.post('/getFormattedNumber/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], contactController.getFormattedNumber)
contactRouter.post('/getCountryCode/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], contactController.getCountryCode)
contactRouter.post('/getProfilePicUrl/:sessionId', [middleware.sessionNameValidation, middleware.sessionValidation], contactController.getProfilePicUrl)
/**
 * ================
 * ADMIN ENDPOINTS
 * ================
 */
const adminRouter = express.Router()
adminRouter.use(middleware.apikey)
adminRouter.use(middleware.requireAdmin)
routes.use('/api/admin', adminRouter)

adminRouter.get('/users', adminController.getUsers)
adminRouter.post('/users', adminController.createUser)
adminRouter.put('/users/:id', adminController.updateUser)
adminRouter.delete('/users/:id', adminController.deleteUser)
adminRouter.get('/settings', adminController.getSettings)
adminRouter.post('/settings', adminController.updateSettings)

/**
 * ====================
 * AUTO REPLY ENDPOINTS
 * ====================
 */
const autoReplyController = require('./controllers/autoReplyController')
const autoReplyRouter = express.Router()
autoReplyRouter.use(middleware.apikey)
autoReplyRouter.use(middleware.sessionOwnership)
routes.use('/api/auto-reply', autoReplyRouter)

autoReplyRouter.get('/:sessionId', autoReplyController.getRules)
autoReplyRouter.post('/:sessionId', autoReplyController.createRule)
autoReplyRouter.put('/rule/:id', autoReplyController.updateRule)
autoReplyRouter.delete('/rule/:id', autoReplyController.deleteRule)
autoReplyRouter.patch('/rule/:id/toggle', autoReplyController.toggleRule)

/**
 * ================
 * SWAGGER ENDPOINTS
 * ================
 */
if (enableSwaggerEndpoint) {
  routes.use('/api-docs', swaggerUi.serve)
  routes.get('/api-docs', swaggerUi.setup(swaggerDocument) /* #swagger.ignore = true */)
}

module.exports = { routes }
