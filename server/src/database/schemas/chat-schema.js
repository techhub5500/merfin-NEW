/**
 * Chat Schema
 * Purpose: store chat history items associated with a user and a sessionId
 * Fields: userId (ref User), sessionId (string), title, origin (initial area), currentArea,
 * messages: [{ id, type, content, timestamp }], timestamps
 */
const mongoose = require('mongoose');

const { Schema } = mongoose;

const messageSubSchema = new Schema({
  id: { type: String, required: true, index: true },
  type: { type: String, required: true, enum: ['user', 'ai'], default: 'user' },
  content: { type: String, required: true },
  timestamp: { type: Date, required: true, default: Date.now }
}, { _id: false });

const chatSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sessionId: { type: String, required: true, unique: true, index: true },
  title: { type: String, trim: true, maxlength: 300, default: '' },
  origin: { type: String, required: true, enum: ['Home', 'Finanças', 'Invest'], index: true },
  currentArea: { type: String, required: true, enum: ['Home', 'Finanças', 'Invest'], index: true },
  messages: { type: [messageSubSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema);
