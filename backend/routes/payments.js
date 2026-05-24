const express = require('express');
const jwt = require('jsonwebtoken');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const router = express.Router();

const protect = async (req, res, next) => {
  let token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Not authorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized' });
  }
};

router.post('/create', protect, async (req, res) => {
  try {
    const { amount, paymentMethod, description } = req.body;
    
    const paymentId = 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const transaction = await Transaction.create({
      user: req.user.id,
      amount: amount,
      paymentMethod: paymentMethod,
      paymentId: paymentId,
      status: 'completed',
      description: description
    });
    
    await User.findByIdAndUpdate(req.user.id, { $inc: { balance: amount } });
    
    res.status(201).json({ success: true, transaction: transaction });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/transactions', protect, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user.id }).sort('-createdAt').limit(50);
    res.json({ success: true, transactions: transactions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
