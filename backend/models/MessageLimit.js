const mongoose = require('mongoose')

const messageLimitSchema = new mongoose.Schema(
  {
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    dailyLimit: {
      type: Number,
      required: true,
      enum: [10, 20, 30, 50],
    },
    currentCount: {
      type: Number,
      default: 0,
    },
    lastResetDate: {
      type: String,
      default: () => new Date().toISOString().slice(0, 10),
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('MessageLimit', messageLimitSchema)