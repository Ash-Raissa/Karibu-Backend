const jwt = require('jsonwebtoken')
const User = require('../models/User')

// Protect routes and optionally restrict access by role.
module.exports = function (...roles) {
    return async (req, res, next) => {
        // Read token from Authorization header: "Bearer <token>".
        const authHeader = req.headers.authorization

        if (!authHeader) {
            return res.status(401).json({ message: 'No token provided' })
        }

        const token = authHeader.split(' ')[1]

        try {
            // Verify token and load current user.
            const decoded = jwt.verify(token, process.env.JWT_SECRET)
            const user = await User.findById(decoded.id).select('role branch tokenVersion')

            if (!user) {
                return res.status(401).json({ message: 'Invalid token' })
            }

            const userTokenVersion = Number(user.tokenVersion || 0)
            const tokenVersion = Number(decoded.tokenVersion || 0)
            if (userTokenVersion !== tokenVersion) {
                return res.status(401).json({ message: 'Session expired. Please login again.' })
            }

            // If roles are provided, user must match one of them.
            // Compare roles case-insensitively to avoid failures from stored casing differences.
            const normalizedUserRole = String(user.role || '').trim().toLowerCase()
            const allowedRoles = roles.map((role) => String(role || '').trim().toLowerCase())
            if (roles.length && !allowedRoles.includes(normalizedUserRole)) {
                return res.status(403).json({ message: 'Access denied' })
            }

            // Save user info for controllers.
            req.user = {
                id: decoded.id,
                role: user.role,
                branch: user.branch,
                tokenVersion: userTokenVersion
            }
            next()
        } catch {
            res.status(401).json({ message: 'Invalid token' })
        }
    }
}
