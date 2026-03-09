const Sales = require('../models/Sales')
const Produce = require('../models/Procurement')
const User = require('../models/User')
const allowedProduce = require('../utils/allowedProduce')

const allowedBranches = ['Matugga', 'Maganjo']

// Find stock left for one produce in one branch (bought minus sold).
async function getAvailableStock({ produceName, branch }) {
  const stockMatch = { produceName, branch }

  const [procured] = await Produce.aggregate([
    {
      $match: stockMatch
    },
    {
      $group: {
        _id: null,
        totalTonnage: { $sum: '$tonnage' }
      }
    }
  ])

  const [sold] = await Sales.aggregate([
    {
      $match: stockMatch
    },
    {
      $group: {
        _id: null,
        totalTonnage: { $sum: '$tonnage' }
      }
    }
  ])

  const totalProcured = procured?.totalTonnage || 0
  const totalSold = sold?.totalTonnage || 0

  return totalProcured - totalSold
}

// Show current stock in the user's branch with remaining quantity and latest price.
async function getAvailableStockReadOnly(req, res) {
  try {
    const branch = req.user.branch

    const procuredStock = await Produce.aggregate([
      { $match: { branch } },
      {
        $group: {
          _id: '$produceName',
          totalTonnage: { $sum: '$tonnage' },
          sellingPrice: { $max: '$sellingPrice' }
        }
      }
    ])

    const soldStock = await Sales.aggregate([
      { $match: { branch } },
      {
        $group: {
          _id: '$produceName',
          soldTonnage: { $sum: '$tonnage' }
        }
      }
    ])

    const soldByProduce = new Map()
    soldStock.forEach((item) => {
      soldByProduce.set(item._id, Number(item.soldTonnage) || 0)
    })

    const data = procuredStock
      .map((item) => {
        const sold = soldByProduce.get(item._id) || 0
        const remaining = (Number(item.totalTonnage) || 0) - sold
        return {
          produceName: item._id,
          totalTonnage: remaining,
          sellingPrice: Number(item.sellingPrice) || 0
        }
      })
      .filter((item) => item.totalTonnage > 0)
      .sort((a, b) => a.produceName.localeCompare(b.produceName))

    res.status(200).json({
      branch,
      count: data.length,
      data
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Save a cash sale after checking inputs, branch, and available stock.
async function recordCashSale(req, res) {
  try {
    const { produceName, tonnage, amountPaid, buyerName, salesAgentName, branch } = req.body
    const produceType = 'Cereal'
    let resolvedSalesAgentName = salesAgentName
    let resolvedBranch = branch

    if ((req.user.role || '') === 'Sales Agent') {
      const user = await User.findById(req.user.id).select('name')
      if (!user) return res.status(404).json({ message: 'User not found' })
      resolvedSalesAgentName = user.name
      resolvedBranch = req.user.branch
    }

    if (!produceName || !tonnage || !amountPaid || !buyerName || !resolvedSalesAgentName || !resolvedBranch) {
      return res.status(400).json({ message: 'All fields are required' })
    }

    if (!allowedProduce.includes(produceName)) {
      return res.status(400).json({
        message: `Invalid produce. Allowed values: ${allowedProduce.join(', ')}.`
      })
    }

    if (buyerName.length < 2 || resolvedSalesAgentName.length < 2) {
      return res.status(400).json({ message: 'Names must be at least 2 characters' })
    }

    if (!allowedBranches.includes(resolvedBranch)) {
      return res.status(400).json({ message: 'Invalid branch. Use Matugga or Maganjo' })
    }

    if (amountPaid < 1000) {
      return res.status(400).json({ message: 'Amount must be valid UGX value' })
    }

    const requestedTonnage = Number(tonnage)
    if (!Number.isFinite(requestedTonnage) || requestedTonnage <= 0) {
      return res.status(400).json({ message: 'Tonnage must be a valid positive number' })
    }

    const availableStock = await getAvailableStock({ produceName, branch: resolvedBranch })
    if (requestedTonnage > availableStock) {
      return res.status(400).json({
        message: `Insufficient stock. Available tonnage is ${availableStock}kg`
      })
    }

    const newSale = await Sales.create({
      produceName,
      produceType,
      tonnage: requestedTonnage,
      amountPaid,
      buyerName,
      salesAgentName: resolvedSalesAgentName,
      branch: resolvedBranch,
      saleType: 'cash'
    })

    res.status(201).json({
      message: 'Cash sale recorded successfully',
      sale: newSale
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// List cash sales, with optional branch filter and total amount.
async function getCashSales(req, res) {
  try {
    const branch = req.query.branch
    const filter = { saleType: 'cash' }

    if (branch) {
      if (!allowedBranches.includes(branch)) {
        return res.status(400).json({ message: 'Invalid branch. Use Matugga or Maganjo' })
      }
      filter.branch = branch
    }

    const cashSales = await Sales.find(filter).sort({ createdAt: -1 })
    const totalAmount = cashSales.reduce((sum, sale) => sum + (sale.amountPaid || 0), 0)

    res.status(200).json({
      message: `Cash sales${branch ? ' for branch ' + branch : ''} retrieved successfully`,
      totalAmount,
      count: cashSales.length,
      sales: cashSales
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Get one cash sale by id and handle bad or missing ids.
async function getCashSaleById(req, res) {
  try {
    const saleId = req.params.id

    if (!saleId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid sale ID format' })
    }

    const sale = await Sales.findOne({ _id: saleId, saleType: 'cash' })

    if (!sale) {
      return res.status(404).json({ message: 'Cash sale not found' })
    }

    res.status(200).json({
      message: 'Cash sale retrieved successfully',
      sale
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Save a credit sale after checking required fields and stock.
async function recordCreditSale(req, res) {
  try {
    const {
      produceName,
      tonnage,
      buyerName,
      nationalId,
      location,
      phone,
      amountDue,
      salesAgentName,
      dueDate,
      dateOfDispatch,
      branch
    } = req.body
    const produceType = 'Cereal'
    let resolvedSalesAgentName = salesAgentName
    let resolvedBranch = branch

    if ((req.user.role || '') === 'Sales Agent') {
      const user = await User.findById(req.user.id).select('name')
      if (!user) return res.status(404).json({ message: 'User not found' })
      resolvedSalesAgentName = user.name
      resolvedBranch = req.user.branch
    }

    if (!produceName || !tonnage || !buyerName || !nationalId || !amountDue || !resolvedSalesAgentName || !dueDate || !resolvedBranch) {
      return res.status(400).json({ message: 'All required fields must be filled' })
    }

    if (!allowedProduce.includes(produceName)) {
      return res.status(400).json({
        message: `Invalid produce. Allowed values: ${allowedProduce.join(', ')}.`
      })
    }

    if (!allowedBranches.includes(resolvedBranch)) {
      return res.status(400).json({ message: 'Invalid branch. Use Matugga or Maganjo' })
    }

    const requestedTonnage = Number(tonnage)
    if (!Number.isFinite(requestedTonnage) || requestedTonnage <= 0) {
      return res.status(400).json({ message: 'Tonnage must be a valid positive number' })
    }

    const availableStock = await getAvailableStock({ produceName, branch: resolvedBranch })
    if (requestedTonnage > availableStock) {
      return res.status(400).json({
        message: `Insufficient stock. Available tonnage is ${availableStock}kg`
      })
    }

    const newCreditSale = await Sales.create({
      produceName,
      produceType,
      tonnage: requestedTonnage,
      buyerName,
      nationalId,
      location,
      phone,
      amountDue,
      salesAgentName: resolvedSalesAgentName,
      dueDate,
      dateOfDispatch,
      branch: resolvedBranch,
      saleType: 'credit',
      paymentStatus: 'unpaid'
    })

    res.status(201).json({
      message: 'Credit sale recorded successfully',
      sale: newCreditSale
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Show today's sales totals for the logged-in sales agent.
async function getSalesAgentPerformance(req, res) {
  try {
    const user = await User.findById(req.user.id).select('name')
    if (!user) return res.status(404).json({ message: 'User not found' })

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const match = {
      salesAgentName: user.name,
      branch: req.user.branch
    }

    const [totals] = await Sales.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalSalesToday: {
            $sum: {
              $cond: [
                { $gte: ['$createdAt', startOfToday] },
                {
                  $cond: [
                    { $eq: ['$saleType', 'cash'] },
                    { $ifNull: ['$amountPaid', 0] },
                    { $ifNull: ['$amountDue', 0] }
                  ]
                },
                0
              ]
            }
          },
          totalCreditIssued: {
            $sum: {
              $cond: [
                { $eq: ['$saleType', 'credit'] },
                { $ifNull: ['$amountDue', 0] },
                0
              ]
            }
          },
          totalRevenue: {
            $sum: {
              $cond: [
                { $eq: ['$saleType', 'cash'] },
                { $ifNull: ['$amountPaid', 0] },
                {
                  $cond: [
                    { $eq: ['$paymentStatus', 'paid'] },
                    { $ifNull: ['$amountDue', 0] },
                    0
                  ]
                }
              ]
            }
          }
        }
      }
    ])

    res.status(200).json({
      success: true,
      data: {
        totalSalesToday: totals?.totalSalesToday || 0,
        totalCreditIssued: totals?.totalCreditIssued || 0,
        totalRevenue: totals?.totalRevenue || 0
      }
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// List credit sales, with optional branch, due date range, and overdue filter.
async function getCreditSales(req, res) {
  try {
    const { branch, dueFrom, dueTo, overdueOnly } = req.query
    const filter = { saleType: 'credit' }

    if (branch) {
      if (!allowedBranches.includes(branch)) {
        return res.status(400).json({ message: 'Invalid branch. Use Matugga or Maganjo' })
      }
      filter.branch = branch
    }

    if (dueFrom || dueTo) {
      filter.dueDate = {}

      if (dueFrom) {
        const from = new Date(dueFrom)
        if (Number.isNaN(from.getTime())) {
          return res.status(400).json({ message: 'Invalid dueFrom value. Use YYYY-MM-DD' })
        }
        from.setHours(0, 0, 0, 0)
        filter.dueDate.$gte = from
      }

      if (dueTo) {
        const to = new Date(dueTo)
        if (Number.isNaN(to.getTime())) {
          return res.status(400).json({ message: 'Invalid dueTo value. Use YYYY-MM-DD' })
        }
        to.setHours(23, 59, 59, 999)
        filter.dueDate.$lte = to
      }

      if (filter.dueDate.$gte && filter.dueDate.$lte && filter.dueDate.$gte > filter.dueDate.$lte) {
        return res.status(400).json({ message: 'dueFrom cannot be later than dueTo' })
      }
    }

    if (String(overdueOnly).toLowerCase() === 'true') {
      const now = new Date()
      filter.paymentStatus = 'unpaid'
      filter.dueDate = {
        ...(filter.dueDate || {}),
        $lt: now
      }
    }

    const creditSales = await Sales.find(filter).sort({ createdAt: -1 })

    res.status(200).json({
      count: creditSales.length,
      sales: creditSales
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Show unpaid credit sales and total amount still owed.
async function getOutstandingCredits(req, res) {
  try {
    const branch = req.query.branch
    const filter = {
      saleType: 'credit',
      paymentStatus: 'unpaid'
    }

    if (branch) {
      if (!allowedBranches.includes(branch)) {
        return res.status(400).json({ message: 'Invalid branch. Use Matugga or Maganjo' })
      }
      filter.branch = branch
    }

    const unpaidCredits = await Sales.find(filter).sort({ dueDate: 1 })
    const totalOutstanding = unpaidCredits.reduce((sum, sale) => sum + (sale.amountDue || 0), 0)

    res.status(200).json({
      totalOutstanding,
      count: unpaidCredits.length,
      sales: unpaidCredits
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Get one credit sale by id and handle bad or missing ids.
async function getCreditSaleById(req, res) {
  try {
    const id = req.params.id

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid ID format' })
    }

    const sale = await Sales.findOne({ _id: id, saleType: 'credit' })

    if (!sale) {
      return res.status(404).json({ message: 'Credit sale not found' })
    }

    res.status(200).json({
      message: 'Credit sale retrieved successfully',
      sale
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Mark a credit sale as paid and save when it was paid.
async function markCreditAsPaid(req, res) {
  try {
    const id = req.params.id

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid ID format' })
    }

    const sale = await Sales.findOne({ _id: id, saleType: 'credit' })

    if (!sale) {
      return res.status(404).json({ message: 'Credit sale not found' })
    }

    if (sale.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Credit already paid' })
    }

    sale.paymentStatus = 'paid'
    sale.paidAt = new Date()

    await sale.save()

    res.status(200).json({
      message: 'Credit marked as paid successfully',
      sale
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

module.exports = {
  getAvailableStockReadOnly,
  recordCashSale,
  getCashSales,
  getCashSaleById,
  recordCreditSale,
  getSalesAgentPerformance,
  getCreditSales,
  getOutstandingCredits,
  getCreditSaleById,
  markCreditAsPaid
}
