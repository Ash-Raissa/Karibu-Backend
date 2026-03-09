const mongoose = require('mongoose')
const allowedProduce = require('../utils/allowedProduce')

// Procurement records for produce bought into stock.
const procurementSchema = new mongoose.Schema(
    {
        produceName: {
            type: String,
            required: true,
            trim: true,
            enum: allowedProduce
        },

        produceType: {
            type: String,
            required: true,
            trim: true,
            enum: ['Cereal'],
            default: 'Cereal'
        },

        date: {
            type: Date,
            required: true
        },

        time: {
            type: String,
            required: true
        },

        tonnage: {
            type: Number,
            required: true,
            min: 1000
        },

        cost: {
            type: Number,
            required: true,
            min: 10000
        },

        dealerName: {
            type: String,
            required: true,
            trim: true,
            minlength: 2
        },

        branch: {
            type: String,
            required: true,
            enum: ['Matugga', 'Maganjo']
        },

        dealerContact: {
            type: String,
            required: true,
            trim: true
        },

        sellingPrice: {
            type: Number,
            required: true,
            min: 10000
        }
},
    { timestamps: true }
)

// Export Procurement model.
module.exports = mongoose.model('Procurement', procurementSchema)
