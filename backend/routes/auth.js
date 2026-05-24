const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

const generateToken = (id) => {
  return jwt.sign({ id: id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
};

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const userExists = await User.findOne({ email: email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    const user = await User.create({ name: name, email: email, password: password });
    const token = generateToken(user._id);
    
    res.status(201).json({ 
      success: true, 
      token: token, 
      user: { 
        id: user._id, 
        name: name, 
        email: email, 
        balance: user.balance 
      } 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email }).select('+password');
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = generateToken(user._id);
    res.json({ 
      success: true, 
      token: token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: email, 
        balance: user.balance 
      } 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
