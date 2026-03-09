const express = require('express')
const router = express.Router()
const authorize = require('../middleware/auth')
const directorController = require('../controllers/directorController')

// Director reporting endpoints for company-wide analytics.
/**
 * @swagger
 * /total-sales:
 *   get:
 *     tags: [Director]
 *     summary: Get total realized sales revenue
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Total revenue
 */
router.get('/total-sales', authorize('Director'), directorController.getTotalSales)

// Revenue by branch.
router.get('/branch-sales', authorize('Director'), directorController.getBranchSales)

/**
 * @swagger
 * /director/summary:
 *   get:
 *     tags: [Director]
 *     summary: Get company-wide summary (aggregate only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Company summary
 */
router.get('/director/summary', authorize('Director'), directorController.getDirectorSummary)

/**
 * @swagger
 * /director/branch-comparison:
 *   get:
 *     tags: [Director]
 *     summary: Get branch performance comparison
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Branch performance
 */
router.get('/director/branch-comparison', authorize('Director'), directorController.getDirectorBranchComparison)

/**
 * @swagger
 * /director/produce-performance:
 *   get:
 *     tags: [Director]
 *     summary: Get produce performance across branches
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Produce performance
 */
router.get('/director/produce-performance', authorize('Director'), directorController.getDirectorProducePerformance)

/**
 * @swagger
 * /director/alerts:
 *   get:
 *     tags: [Director]
 *     summary: Get company-wide alerts
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Alerts payload
 */
router.get('/director/alerts', authorize('Director'), directorController.getDirectorAlerts)

// Other director reports.
router.get('/total-procurement', authorize('Director'), directorController.getTotalProcurement)
router.get('/outstanding-credit', authorize('Director', 'Manager'), directorController.getOutstandingCredit)
router.get('/stock-summary', authorize('Director'), directorController.getStockSummaryReport)

// Export director routes.
module.exports = router
