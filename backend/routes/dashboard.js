const express = require('express');
const { protect } = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const router = express.Router();

router.get('/stats', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const totalTransactions = await Transaction.countDocuments({ user: req.user.id });
    const completedTransactions = await Transaction.countDocuments({ 
      user: req.user.id, 
      status: 'completed' 
    });
    
    const totalAmount = await Transaction.aggregate([
      { $match: { user: req.user._id, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const recentTransactions = await Transaction.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      stats: {
        balance: user.balance,
        totalTransactions,
        completedTransactions,
        totalAmount: totalAmount[0]?.total || 0,
        recentTransactions
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
