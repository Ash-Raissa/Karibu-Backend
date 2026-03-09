const express = require('express')
const router = express.Router()
const authorize = require('../middleware/auth')
const salesAgentController = require('../controllers/salesAgentController')

// Sales endpoints for stock, cash sales, and credit sales.
/**
 * @swagger
 * /stock/available:
 *   get:
 *     tags: [Sales Agent]
 *     summary: View available stock (read-only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available stock list
 */
router.get('/stock/available', authorize('Sales Agent'), salesAgentController.getAvailableStockReadOnly)

/**
 * @swagger
 * /cash:
 *   post:
 *     tags: [Sales Agent]
 *     summary: Record a cash sale
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Cash sale recorded
 */
router.post('/cash', authorize('Manager', 'Sales Agent'), salesAgentController.recordCashSale)

// Read cash sales and one cash sale by id.
router.get('/cash-sales', authorize('Manager', 'Sales Agent'), salesAgentController.getCashSales)
router.get('/cash/:id', authorize('Manager', 'Sales Agent'), salesAgentController.getCashSaleById)

/**
 * @swagger
 * /credit:
 *   post:
 *     tags: [Sales Agent]
 *     summary: Record a credit sale
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Credit sale recorded
 */
router.post('/credit', authorize('Manager', 'Sales Agent'), salesAgentController.recordCreditSale)

/**
 * @swagger
 * /sales-agent/performance:
 *   get:
 *     tags: [Sales Agent]
 *     summary: Get current sales agent performance
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance totals
 */
router.get('/sales-agent/performance', authorize('Sales Agent'), salesAgentController.getSalesAgentPerformance)

/**
 * @swagger
 * /credit-sales:
 *   get:
 *     tags: [Sales Agent]
 *     summary: List credit sales
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Credit sales list
 */
router.get('/credit-sales', authorize('Manager', 'Sales Agent'), salesAgentController.getCreditSales)

// Credit sale details, outstanding list, and payment update.
router.get('/credit/outstanding', authorize('Manager', 'Sales Agent'), salesAgentController.getOutstandingCredits)
router.get('/credit/:id', authorize('Manager', 'Sales Agent'), salesAgentController.getCreditSaleById)

/**
 * @swagger
 * /credit/{id}/pay:
 *   patch:
 *     tags: [Sales Agent]
 *     summary: Mark credit payment as paid
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment marked as paid
 */
router.patch('/credit/:id/pay', authorize('Manager', 'Sales Agent'), salesAgentController.markCreditAsPaid)

// Export sales-agent routes.
module.exports = router
