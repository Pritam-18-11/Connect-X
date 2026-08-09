const MessageLimit = require('../models/MessageLimit')

/**
 * Shared utility — used by both socket/index.js and routes/chat.js
 * Checks if sender has exceeded the daily limit set by receiver.
 */
async function checkAndUpdateLimit(senderUserId, receiverUserId) {
  const today = new Date().toISOString().slice(0, 10)

  const limit = await MessageLimit.findOne({
    ownerUserId: receiverUserId,
    targetUserId: senderUserId,
  })

  if (!limit) return { allowed: true }

  if (limit.lastResetDate !== today) {
    limit.currentCount = 0
    limit.lastResetDate = today
    await limit.save()
  }

  if (limit.currentCount >= limit.dailyLimit) {
    return {
      allowed: false,
      message: `Daily message limit of ${limit.dailyLimit} reached. Try again tomorrow.`,
    }
  }

  limit.currentCount += 1
  await limit.save()

  return { allowed: true, remaining: limit.dailyLimit - limit.currentCount }
}

module.exports = { checkAndUpdateLimit }