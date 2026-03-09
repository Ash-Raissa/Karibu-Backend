const Sales = require('../models/Sales')
const Procurement = require('../models/Procurement')
const Stock = require('../models/Stock')

const saleValueExpr = {
  $cond: [
    { $eq: ['$saleType', 'cash'] },
    { $ifNull: ['$amountPaid', 0] },
    { $ifNull: ['$amountDue', 0] }
  ]
}

const realizedRevenueExpr = {
  $cond: [
    { $eq: ['$saleType', 'cash'] },
    { $ifNull: ['$amountPaid', 0] },
    {
      $cond: [
        { $and: [{ $eq: ['$saleType', 'credit'] }, { $eq: ['$paymentStatus', 'paid'] }] },
        { $ifNull: ['$amountDue', 0] },
        0
      ]
    }
  ]
}

// Get total company revenue from cash sales and paid credit sales.
async function getTotalSales(req, res) {
  try {
    const total = await Sales.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: realizedRevenueExpr }
        }
      }
    ])

    res.status(200).json({
      totalRevenue: total[0]?.totalRevenue || 0
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Get revenue totals for each branch.
async function getBranchSales(req, res) {
  try {
    const branchTotals = await Sales.aggregate([
      {
        $group: {
          _id: '$branch',
          totalRevenue: { $sum: realizedRevenueExpr }
        }
      },
      {
        $sort: { totalRevenue: -1 }
      }
    ])

    res.status(200).json(branchTotals)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Get director dashboard totals for procurement, sales, credit, stock, and profit estimate.
async function getDirectorSummary(req, res) {
  try {
    const [procurementTotals, salesTotals, soldByProduce, procuredByProduce] = await Promise.all([
      Procurement.aggregate([
        {
          $group: {
            _id: null,
            totalProcurementValue: { $sum: '$cost' },
            totalProcuredTonnage: { $sum: '$tonnage' }
          }
        }
      ]),
      Sales.aggregate([
        {
          $group: {
            _id: null,
            totalSalesRevenue: { $sum: realizedRevenueExpr },
            totalCreditIssued: {
              $sum: {
                $cond: [{ $eq: ['$saleType', 'credit'] }, { $ifNull: ['$amountDue', 0] }, 0]
              }
            },
            totalOutstandingCredit: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$saleType', 'credit'] }, { $eq: ['$paymentStatus', 'unpaid'] }] },
                  { $ifNull: ['$amountDue', 0] },
                  0
                ]
              }
            }
          }
        }
      ]),
      Sales.aggregate([
        {
          $group: {
            _id: { produceName: '$produceName', branch: '$branch' },
            soldTonnage: { $sum: '$tonnage' }
          }
        }
      ]),
      Procurement.aggregate([
        {
          $group: {
            _id: { produceName: '$produceName', branch: '$branch' },
            totalTonnage: { $sum: '$tonnage' },
            totalCost: { $sum: '$cost' },
            totalSellingValue: { $sum: { $multiply: ['$sellingPrice', '$tonnage'] } }
          }
        }
      ])
    ])

    const soldMap = new Map()
    soldByProduce.forEach((item) => {
      const key = `${item._id.produceName}::${item._id.branch}`
      soldMap.set(key, Number(item.soldTonnage) || 0)
    })

    let totalStockAcrossBranches = 0
    let totalProfitEstimate = 0
    procuredByProduce.forEach((item) => {
      const key = `${item._id.produceName}::${item._id.branch}`
      const procured = Number(item.totalTonnage) || 0
      const sold = soldMap.get(key) || 0
      const available = Math.max(procured - sold, 0)
      totalStockAcrossBranches += available

      if (procured > 0) {
        const avgCost = (Number(item.totalCost) || 0) / procured
        const avgSell = (Number(item.totalSellingValue) || 0) / procured
        totalProfitEstimate += (avgSell - avgCost) * sold
      }
    })

    const p = procurementTotals[0] || {}
    const s = salesTotals[0] || {}

    res.status(200).json({
      totalStockAcrossBranches,
      totalProcurementValue: p.totalProcurementValue || 0,
      totalSalesRevenue: s.totalSalesRevenue || 0,
      totalCreditIssued: s.totalCreditIssued || 0,
      totalOutstandingCredit: s.totalOutstandingCredit || 0,
      totalProfitEstimate
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Compare branches by sales, credit given, and stock left.
async function getDirectorBranchComparison(req, res) {
  try {
    const [salesByBranch, procuredByBranch, soldByBranch] = await Promise.all([
      Sales.aggregate([
        {
          $group: {
            _id: '$branch',
            totalSales: { $sum: saleValueExpr },
            totalCredit: {
              $sum: {
                $cond: [{ $eq: ['$saleType', 'credit'] }, { $ifNull: ['$amountDue', 0] }, 0]
              }
            }
          }
        }
      ]),
      Procurement.aggregate([
        {
          $group: {
            _id: '$branch',
            totalProcured: { $sum: '$tonnage' }
          }
        }
      ]),
      Sales.aggregate([
        {
          $group: {
            _id: '$branch',
            totalSold: { $sum: '$tonnage' }
          }
        }
      ])
    ])

    const branchMap = new Map()
    ;['Maganjo', 'Matugga'].forEach((branch) => {
      branchMap.set(branch, {
        branch,
        totalSales: 0,
        totalCredit: 0,
        stockRemaining: 0
      })
    })

    salesByBranch.forEach((row) => {
      if (!branchMap.has(row._id)) branchMap.set(row._id, { branch: row._id, totalSales: 0, totalCredit: 0, stockRemaining: 0 })
      const current = branchMap.get(row._id)
      current.totalSales = row.totalSales || 0
      current.totalCredit = row.totalCredit || 0
    })

    const soldMap = new Map(soldByBranch.map((row) => [row._id, row.totalSold || 0]))
    procuredByBranch.forEach((row) => {
      if (!branchMap.has(row._id)) branchMap.set(row._id, { branch: row._id, totalSales: 0, totalCredit: 0, stockRemaining: 0 })
      const current = branchMap.get(row._id)
      const remaining = (row.totalProcured || 0) - (soldMap.get(row._id) || 0)
      current.stockRemaining = remaining > 0 ? remaining : 0
    })

    const data = Array.from(branchMap.values()).sort((a, b) => a.branch.localeCompare(b.branch))
    res.status(200).json({ count: data.length, data })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Show produce performance across branches: sold amount, revenue, and estimated profit.
async function getDirectorProducePerformance(req, res) {
  try {
    const [soldByProduceBranch, pricingByProduceBranch] = await Promise.all([
      Sales.aggregate([
        {
          $group: {
            _id: { produceName: '$produceName', branch: '$branch' },
            totalSold: { $sum: '$tonnage' },
            revenue: { $sum: saleValueExpr }
          }
        }
      ]),
      Procurement.aggregate([
        {
          $group: {
            _id: { produceName: '$produceName', branch: '$branch' },
            totalTonnage: { $sum: '$tonnage' },
            totalCost: { $sum: '$cost' },
            totalSellingValue: { $sum: { $multiply: ['$sellingPrice', '$tonnage'] } }
          }
        }
      ])
    ])

    const pricingMap = new Map()
    pricingByProduceBranch.forEach((row) => {
      const key = `${row._id.produceName}::${row._id.branch}`
      const tonnage = Number(row.totalTonnage) || 0
      if (tonnage <= 0) return
      pricingMap.set(key, {
        avgCost: (Number(row.totalCost) || 0) / tonnage,
        avgSell: (Number(row.totalSellingValue) || 0) / tonnage
      })
    })

    const produceMap = new Map()
    soldByProduceBranch.forEach((row) => {
      const produceName = row._id.produceName
      const sold = Number(row.totalSold) || 0
      const revenue = Number(row.revenue) || 0
      const pricing = pricingMap.get(`${produceName}::${row._id.branch}`)
      const profit = pricing ? (pricing.avgSell - pricing.avgCost) * sold : 0

      if (!produceMap.has(produceName)) {
        produceMap.set(produceName, { produceName, totalSold: 0, revenue: 0, profit: 0 })
      }

      const current = produceMap.get(produceName)
      current.totalSold += sold
      current.revenue += revenue
      current.profit += profit
    })

    const data = Array.from(produceMap.values()).sort((a, b) => a.produceName.localeCompare(b.produceName))
    res.status(200).json({ count: data.length, data })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Show alerts for overdue credits and low-stock branches.
async function getDirectorAlerts(req, res) {
  try {
    const now = new Date()
    const overdueCutoff = new Date(now)
    overdueCutoff.setDate(overdueCutoff.getDate() - 30)

    const [overdueByBranch, procuredByBranch, soldByBranch] = await Promise.all([
      Sales.aggregate([
        {
          $match: {
            saleType: 'credit',
            paymentStatus: 'unpaid',
            dueDate: { $lte: overdueCutoff }
          }
        },
        {
          $group: {
            _id: '$branch',
            count: { $sum: 1 },
            totalAmount: { $sum: { $ifNull: ['$amountDue', 0] } }
          }
        }
      ]),
      Procurement.aggregate([
        {
          $group: {
            _id: '$branch',
            totalProcured: { $sum: '$tonnage' }
          }
        }
      ]),
      Sales.aggregate([
        {
          $group: {
            _id: '$branch',
            totalSold: { $sum: '$tonnage' }
          }
        }
      ])
    ])

    const overdue = {
      totalCount: overdueByBranch.reduce((sum, row) => sum + (row.count || 0), 0),
      totalAmount: overdueByBranch.reduce((sum, row) => sum + (row.totalAmount || 0), 0),
      byBranch: overdueByBranch.map((row) => ({
        branch: row._id,
        count: row.count || 0,
        totalAmount: row.totalAmount || 0
      }))
    }

    const soldMap = new Map(soldByBranch.map((row) => [row._id, row.totalSold || 0]))
    const lowStockBranches = procuredByBranch
      .map((row) => ({
        branch: row._id,
        stockRemaining: Math.max((row.totalProcured || 0) - (soldMap.get(row._id) || 0), 0)
      }))
      .filter((row) => row.stockRemaining < 500)
      .sort((a, b) => a.stockRemaining - b.stockRemaining)

    res.status(200).json({ overdueCredits30Days: overdue, lowStockBranches })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Get total procurement cost and total procured tonnage.
async function getTotalProcurement(req, res) {
  try {
    const result = await Procurement.aggregate([
      {
        $group: {
          _id: null,
          totalCost: { $sum: '$cost' },
          totalTonnage: { $sum: '$tonnage' }
        }
      }
    ])

    res.status(200).json({
      totalCost: result[0]?.totalCost || 0,
      totalTonnage: result[0]?.totalTonnage || 0
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Get total unpaid credit balance.
async function getOutstandingCredit(req, res) {
  try {
    const outstanding = await Sales.aggregate([
      {
        $match: {
          saleType: 'credit',
          paymentStatus: 'unpaid'
        }
      },
      {
        $group: {
          _id: null,
          totalOutstanding: { $sum: '$amountDue' }
        }
      }
    ])

    res.status(200).json({
      totalOutstanding: outstanding[0]?.totalOutstanding || 0
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Get stock totals by branch and produce.
async function getStockSummaryReport(req, res) {
  try {
    const summary = await Stock.aggregate([
      {
        $group: {
          _id: {
            branch: '$branch',
            produceName: '$produceName'
          },
          totalStock: { $sum: '$totalTonnage' }
        }
      },
      {
        $sort: { '_id.branch': 1 }
      }
    ])

    res.status(200).json(summary)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

module.exports = {
  getTotalSales,
  getBranchSales,
  getDirectorSummary,
  getDirectorBranchComparison,
  getDirectorProducePerformance,
  getDirectorAlerts,
  getTotalProcurement,
  getOutstandingCredit,
  getStockSummaryReport
}
