const Produce = require('../models/Procurement')
const Stock = require('../models/Stock')
const Sales = require('../models/Sales')
const mongoose = require('mongoose')

// Get manager dashboard numbers for stock, sales, and estimated profit.
async function getManagerStats(req, res) {
  try {
    const managerBranch = req.user.branch
    const now = new Date()
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)

    const startOfWeek = new Date(startOfToday)
    const dayOfWeek = startOfWeek.getDay()
    const mondayOffset = (dayOfWeek + 6) % 7
    startOfWeek.setDate(startOfWeek.getDate() - mondayOffset)

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const amountBySaleType = {
      $cond: [
        { $eq: ['$saleType', 'cash'] },
        { $ifNull: ['$amountPaid', 0] },
        { $ifNull: ['$amountDue', 0] }
      ]
    }

    const salesMatch = managerBranch ? { branch: managerBranch } : {}

    const [totalProcurements, stockStats, salesStats, procurementPricing, soldByProduce] = await Promise.all([
      Produce.countDocuments(),
      Produce.aggregate([
        {
          $group: {
            _id: null,
            totalStock: { $sum: '$tonnage' },
            totalValue: { $sum: { $multiply: ['$tonnage', '$sellingPrice'] } }
          }
        }
      ]),
      Sales.aggregate([
        { $match: salesMatch },
        {
          $group: {
            _id: null,
            totalSalesToday: {
              $sum: {
                $cond: [{ $gte: ['$createdAt', startOfToday] }, amountBySaleType, 0]
              }
            },
            totalSalesThisWeek: {
              $sum: {
                $cond: [{ $gte: ['$createdAt', startOfWeek] }, amountBySaleType, 0]
              }
            },
            totalSalesThisMonth: {
              $sum: {
                $cond: [{ $gte: ['$createdAt', startOfMonth] }, amountBySaleType, 0]
              }
            },
            totalCreditSales: {
              $sum: {
                $cond: [
                  { $eq: ['$saleType', 'credit'] },
                  { $ifNull: ['$amountDue', 0] },
                  0
                ]
              }
            },
            revenueGenerated: {
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
      ]),
      Produce.aggregate([
        ...(managerBranch ? [{ $match: { branch: managerBranch } }] : []),
        {
          $group: {
            _id: {
              produceName: '$produceName',
              branch: '$branch'
            },
            totalTonnage: { $sum: '$tonnage' },
            totalCost: { $sum: '$cost' },
            totalSellingValue: { $sum: { $multiply: ['$sellingPrice', '$tonnage'] } }
          }
        }
      ]),
      Sales.aggregate([
        { $match: salesMatch },
        {
          $group: {
            _id: {
              produceName: '$produceName',
              branch: '$branch'
            },
            soldTonnage: { $sum: '$tonnage' }
          }
        }
      ])
    ])

    const pricingMap = new Map()
    procurementPricing.forEach((item) => {
      const key = `${item._id.produceName}::${item._id.branch}`
      const totalTonnage = Number(item.totalTonnage) || 0
      if (totalTonnage <= 0) return

      const avgCostPerKg = (Number(item.totalCost) || 0) / totalTonnage
      const avgSellingPerKg = (Number(item.totalSellingValue) || 0) / totalTonnage
      pricingMap.set(key, { avgCostPerKg, avgSellingPerKg })
    })

    let profitEstimate = 0
    soldByProduce.forEach((item) => {
      const key = `${item._id.produceName}::${item._id.branch}`
      const pricing = pricingMap.get(key)
      if (!pricing) return
      const soldTonnage = Number(item.soldTonnage) || 0
      profitEstimate += (pricing.avgSellingPerKg - pricing.avgCostPerKg) * soldTonnage
    })

    const salesData = salesStats[0] || {}

    res.status(200).json({
      success: true,
      data: {
        totalProcurements,
        totalStock: stockStats[0]?.totalStock || 0,
        totalValue: stockStats[0]?.totalValue || 0,
        totalSalesToday: salesData.totalSalesToday || 0,
        totalSalesThisWeek: salesData.totalSalesThisWeek || 0,
        totalSalesThisMonth: salesData.totalSalesThisMonth || 0,
        totalCreditSales: salesData.totalCreditSales || 0,
        revenueGenerated: salesData.revenueGenerated || 0,
        profitEstimate
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

// Save a new procurement record and update stock for that branch.
async function procureProduce(req, res) {
  try {
    req.body.produceType = 'Cereal'
    const produce = new Produce(req.body)
    await produce.save()

    await Stock.findOneAndUpdate(
      {
        produceName: produce.produceName,
        produceType: produce.produceType,
        branch: produce.branch
      },
      {
        $inc: { totalTonnage: Number(produce.tonnage) },
        $set: { sellingPrice: Number(produce.sellingPrice) }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    )

    res.status(201).json({
      message: 'Produce successfully recorded',
      data: produce
    })
  } catch (error) {
    res.status(400).json({
      message: 'Validation failed',
      error: error.message
    })
  }
}

// List procurements, with optional date range filter.
async function listProcurements(req, res) {
  try {
    const { dateFrom, dateTo } = req.query
    const filter = {}

    if (dateFrom || dateTo) {
      filter.date = {}

      if (dateFrom) {
        const from = new Date(dateFrom)
        if (Number.isNaN(from.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid dateFrom value. Use YYYY-MM-DD.'
          })
        }
        from.setHours(0, 0, 0, 0)
        filter.date.$gte = from
      }

      if (dateTo) {
        const to = new Date(dateTo)
        if (Number.isNaN(to.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid dateTo value. Use YYYY-MM-DD.'
          })
        }
        to.setHours(23, 59, 59, 999)
        filter.date.$lte = to
      }

      if (filter.date.$gte && filter.date.$lte && filter.date.$gte > filter.date.$lte) {
        return res.status(400).json({
          success: false,
          message: 'dateFrom cannot be later than dateTo.'
        })
      }
    }

    const procurements = await Produce.find(filter).sort({ createdAt: -1, date: -1, time: -1 })

    res.status(200).json({
      success: true,
      count: procurements.length,
      data: procurements
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

// Get one procurement by id after checking the id format.
async function getProcurementById(req, res) {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid procurement ID' })
    }

    const procurement = await Produce.findById(id)

    if (!procurement) {
      return res.status(404).json({ success: false, message: 'Procurement not found' })
    }

    res.status(200).json({ success: true, data: procurement })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// Update a procurement record after checking the id.
async function updateProcurement(req, res) {
  try {
    const { id } = req.params
    req.body.produceType = 'Cereal'

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid procurement ID'
      })
    }

    const updatedProcurement = await Produce.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    )

    if (!updatedProcurement) {
      return res.status(404).json({
        success: false,
        message: 'Procurement not found'
      })
    }

    res.status(200).json({
      success: true,
      message: 'Procurement updated successfully',
      data: updatedProcurement
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

// Delete a procurement record by id.
async function deleteProcurement(req, res) {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid procurement ID'
      })
    }

    const deletedProcurement = await Produce.findByIdAndDelete(id)

    if (!deletedProcurement) {
      return res.status(404).json({
        success: false,
        message: 'Procurement not found'
      })
    }

    res.status(200).json({
      success: true,
      message: 'Procurement deleted successfully',
      data: deletedProcurement
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

// Show stock left per produce and branch (procured minus sold).
async function getStockSummary(req, res) {
  try {
    const { branch } = req.query
    const filter = {}

    if (branch) {
      const normalizedBranch = branch.trim()
      const allowedBranches = ['Matugga', 'Maganjo']

      if (!allowedBranches.includes(normalizedBranch)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid branch. Use Matugga or Maganjo.'
        })
      }

      filter.branch = normalizedBranch
    }

    const procuredStock = await Produce.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            produceName: '$produceName',
            branch: '$branch'
          },
          totalTonnage: { $sum: '$tonnage' },
          sellingPrice: { $max: '$sellingPrice' },
          latestProcuredAt: { $max: '$createdAt' }
        }
      },
      { $match: { totalTonnage: { $gt: 0 } } },
      {
        $project: {
          _id: 0,
          produceName: '$_id.produceName',
          produceType: { $literal: 'Cereal' },
          branch: '$_id.branch',
          totalTonnage: 1,
          sellingPrice: 1,
          latestProcuredAt: 1
        }
      },
      { $sort: { latestProcuredAt: -1, branch: 1, produceName: 1 } }
    ])

    const soldFilter = {}
    if (filter.branch) {
      soldFilter.branch = filter.branch
    }

    const soldStock = await Sales.aggregate([
      { $match: soldFilter },
      {
        $group: {
          _id: {
            produceName: '$produceName',
            branch: '$branch'
          },
          soldTonnage: { $sum: '$tonnage' }
        }
      }
    ])

    const soldByKey = new Map()
    soldStock.forEach((item) => {
      const key = `${item._id.produceName}::${item._id.branch}`
      soldByKey.set(key, Number(item.soldTonnage) || 0)
    })

    const stock = procuredStock
      .map((item) => {
        const key = `${item.produceName}::${item.branch}`
        const sold = soldByKey.get(key) || 0
        const remaining = (Number(item.totalTonnage) || 0) - sold

        return {
          ...item,
          totalTonnage: remaining
        }
      })
      .filter((item) => item.totalTonnage > 0)

    res.status(200).json({
      success: true,
      count: stock.length,
      data: stock
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stock',
      error: error.message
    })
  }
}

module.exports = {
  getManagerStats,
  procureProduce,
  listProcurements,
  getProcurementById,
  updateProcurement,
  deleteProcurement,
  getStockSummary
}
