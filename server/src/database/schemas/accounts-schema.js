/**
 * NOTE (accounts-schema.js):
 * Purpose: Define the `Account` model storing user bank accounts and balances.
 * Controls: `userId`, `currency`, `balance`, `status`, and timestamps (`createdAt`, `updatedAt`).
 * Behavior: Validates `balance` as a finite number. Use `timestamps` to detect changes.
 * Integration notes: Invalidate cache tag `account:{accountId}` after mutations.
 */
const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * Account Schema
 * Campos obrigatórios: userId, currency, balance, status, createdAt
 * Padrões: currency 'BRL', balance 0.0, status 'active', createdAt = now
 */
const accountSchema = new Schema({
	userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
	accountName: { type: String, trim: true, maxlength: 100, comment: 'Nome da conta (opcional)' },
	accountType: { 
		type: String, 
		enum: ['checking', 'savings', 'investment', 'cash', 'other'], 
		default: 'checking',
		comment: 'Tipo de conta'
	},
	currency: { type: String, required: true, enum: ['BRL'], default: 'BRL' },
	balance: {
		type: Number,
		required: true,
		default: 0.0,
		validate: {
			validator: Number.isFinite,
			message: 'Balance must be a finite number'
		}
	},
	status: { type: String, required: true, enum: ['active', 'suspended', 'closed'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('Account', accountSchema);
