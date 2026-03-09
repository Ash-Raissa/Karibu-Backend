const mongoose = require('mongoose')
const allowedProduce = require('../utils/allowedProduce')

// Sales records for both cash and credit sales.
const salesSchema = new mongoose.Schema({
   produceName: { type: String, required: true, trim: true, enum: allowedProduce },
   produceType: { type: String, required: true, trim: true, enum: ['Cereal'], default: 'Cereal' },
   tonnage: { type: Number, required: true },

   buyerName: { type: String, required: true, minlength: 2 },
   salesAgentName: { type: String, required: true, minlength: 2 },
   branch: {
      type: String,
      required: true,
      enum: ['Matugga', 'Maganjo']
   },

   saleType: {
      type: String,
      enum: ['cash', 'credit'],
      required: true
   },

   // Fields needed only for cash sales.
   amountPaid: {
      type: Number,
      required: function () {
         return this.saleType === 'cash'
      }
   },

   // Fields needed only for credit sales.
   nationalId: {
      type: String,
      required: function () {
         return this.saleType === 'credit'
      }
   },
   phone: String,
   location: String,
   amountDue: {
      type: Number,
      required: function () {
         return this.saleType === 'credit'
      }
   },
   dueDate: Date,
   dateOfDispatch: Date,

   paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid'],
      default: 'unpaid'
   },
   paidAt: Date

}, { timestamps: true })

// Export Sales model.
module.exports = mongoose.model('Sales', salesSchema)
