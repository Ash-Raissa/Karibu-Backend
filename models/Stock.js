const mongoose = require('mongoose');
const allowedProduce = require('../utils/allowedProduce');

// Current stock per produce and branch.
const stockSchema = new mongoose.Schema({
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
    branch: {
        type: String,
        required: true,
        enum: ['Matugga', 'Maganjo']
    },
    totalTonnage: {
        type: Number,
        default: 0,
        min: 0
    },
    sellingPrice: {
        type: Number,
        required: true,
        min: 0
    }
});

// Keep one stock record per produce, type, and branch.
stockSchema.index({ produceName: 1, produceType: 1, branch: 1 }, { unique: true });

// Export Stock model.
module.exports = mongoose.model('Stock', stockSchema);
