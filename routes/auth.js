const express = require('express')
const authorize = require('../middleware/auth')
const authController = require('../controllers/authController')

const router = express.Router()

// Auth and user-management endpoints.
/**
 * @swagger
 * /register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user (Director only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: User created
 */
router.post('/register', authorize('Director'), authController.registerUser)

/**
 * @swagger
 * /users:
 *   get:
 *     tags: [Auth]
 *     summary: Get all users (Director only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 */
router.get('/users', authorize('Director'), authController.getUsers)

/**
 * @swagger
 * /login:
 *   post:
 *     tags: [Auth]
 *     summary: Login user and return JWT
 *     security: []
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post('/login', authController.login)

/**
 * @swagger
 * /logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', authorize(), authController.logout)

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     tags: [Auth]
 *     summary: Get currently authenticated user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 */
router.get('/auth/profile', authorize(), authController.getProfile)

// Export auth routes.
module.exports = router
