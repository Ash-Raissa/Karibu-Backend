const mongoose = require('mongoose')

// User accounts used for login and role-based access.
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        minlength: 2
    },
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    phone: {
        type: String,
        required: true
    },
    role: {
        type: String,
        required: true,
        enum: ['Manager', 'Sales Agent', 'Director']
    },
    branch: {
        type: String,
        required: true,
        enum: ['Matugga', 'Maganjo']
    },
    tokenVersion: {
        type: Number,
        default: 0
    }
})

// Export User model.
module.exports = mongoose.model('User', userSchema)
