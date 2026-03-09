const express = require('express')
const router = express.Router()
const authorize = require('../middleware/auth')
const managerController = require('../controllers/managerController')

// Manager endpoints for procurements, stock, and dashboard stats.
/**
 * @swagger
 * /manager/stats:
 *   get:
 *     tags: [Manager]
 *     summary: Get manager dashboard statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Manager stats
 */
router.get('/manager/stats', authorize('Manager'), managerController.getManagerStats)

/**
 * @swagger
 * /procure:
 *   post:
 *     tags: [Manager]
 *     summary: Record a procurement
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Procurement recorded
 */
router.post('/procure', authorize('Manager'), managerController.procureProduce)

/**
 * @swagger
 * /procure:
 *   get:
 *     tags: [Manager]
 *     summary: List procurements
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Procurement history
 */
router.get('/procure', authorize('Manager'), managerController.listProcurements)

// Get one procurement by id.
router.get('/procure/:id', authorize('Manager'), managerController.getProcurementById)

/**
 * @swagger
 * /procure/{id}:
 *   patch:
 *     tags: [Manager]
 *     summary: Update a procurement
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Procurement updated
 */
router.patch('/procure/:id', authorize('Manager'), managerController.updateProcurement)

/**
 * @swagger
 * /procure/{id}:
 *   delete:
 *     tags: [Manager]
 *     summary: Delete a procurement
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Procurement deleted
 */
router.delete('/procure/:id', authorize('Manager'), managerController.deleteProcurement)

/**
 * @swagger
 * /stock:
 *   get:
 *     tags: [Manager]
 *     summary: Get stock summary
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stock summary
 */
router.get('/stock', authorize('Manager'), managerController.getStockSummary)

// Export manager routes.
module.exports = router
