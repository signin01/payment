const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
require('dotenv').config();
const fs = require('fs');
const axios = require('axios');

const app = express();

// ============ CORS CONFIGURATION FOR PRODUCTION ============
const allowedOrigins = [
    'http://localhost:3000',
    'https://bharatpay-frontend.onrender.com',
    'https://bharatpay-backend.onrender.com'
];

app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'CORS policy does not allow access from this origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true
}));

app.use(express.json());

// MSG91 AUTH KEY
const MSG91_AUTH_KEY = '519353AajBxf3K6a120f1cP1';

// File-based storage
const DATA_FILE = 'database.json';
let users = [];
let transactions = [];
let paymentOrders = [];

try {
    if (fs.existsSync(DATA_FILE)) {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        users = data.users || [];
        transactions = data.transactions || [];
        console.log(`✅ Loaded ${users.length} users`);
    }
} catch (error) {
    console.log('Starting fresh database');
}

function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users, transactions }, null, 2));
}

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_SsuX8Ox4XICxUr',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'wpKHteId4ES6qmOSDxLyPp7q'
});

// Auth middleware
const auth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
        req.userId = decoded.id;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

// Send SMS function
async function sendSMS(phoneNumber, message) {
    if (!phoneNumber || phoneNumber.length < 10) {
        console.log('❌ Invalid phone number:', phoneNumber);
        return false;
    }
    
    let cleanNumber = phoneNumber.replace(/\D/g, '');
    if (cleanNumber.length === 10) {
        cleanNumber = '91' + cleanNumber;
    }
    
    console.log(`📱 Sending SMS to ${cleanNumber}...`);
    
    try {
        const response = await axios.get('https://api.msg91.com/api/sendhttp.php', {
            params: {
                authkey: MSG91_AUTH_KEY,
                mobiles: cleanNumber,
                message: message,
                sender: 'BharatP',
                route: '4',
                country: '91'
            }
        });
        
        if (response.data.includes('success') || response.data.includes('Message Sent')) {
            console.log(`✅ SMS sent successfully`);
            return true;
        } else {
            console.log(`❌ SMS failed:`, response.data);
            return false;
        }
    } catch (error) {
        console.error('❌ SMS error:', error.message);
        return false;
    }
}

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ message: 'User already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = {
            id: users.length + 1,
            name: name,
            email: email,
            phone: phone || '',
            password: hashedPassword,
            balance: 100000,
            totalSpent: 0,
            createdAt: new Date()
        };
        users.push(user);
        
        transactions.push({
            id: Date.now(),
            userId: user.id,
            amount: 100000,
            type: 'credit',
            description: 'Welcome Bonus - ₹1,00,000 credited',
            status: 'completed',
            createdAt: new Date()
        });
        
        saveData();
        
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secret123');
        res.json({ success: true, token, user: { id: user.id, name, email, balance: user.balance, phone: user.phone } });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = users.find(u => u.email === email);
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ message: 'Invalid credentials' });
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secret123');
        res.json({ success: true, token, user: { id: user.id, name: user.name, email, balance: user.balance, phone: user.phone } });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Dashboard
app.get('/api/dashboard/stats', auth, (req, res) => {
    const user = users.find(u => u.id === req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const userTransactions = transactions.filter(t => t.userId === req.userId);
    res.json({
        success: true,
        stats: {
            name: user.name,
            email: user.email,
            phone: user.phone,
            balance: user.balance,
            totalTransactions: userTransactions.length,
            totalAmount: userTransactions.reduce((sum, t) => sum + t.amount, 0),
            recentTransactions: userTransactions.slice(-5).reverse()
        }
    });
});

// Create Razorpay Order
app.post('/api/create-order', auth, async (req, res) => {
    try {
        const { amount } = req.body;
        const options = {
            amount: amount * 100,
            currency: 'INR',
            receipt: `receipt_${Date.now()}`,
            payment_capture: 1
        };
        const order = await razorpay.orders.create(options);
        paymentOrders.push({ orderId: order.id, userId: req.userId, amount: amount });
        res.json({ success: true, orderId: order.id, amount: amount, keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_SsuX8Ox4XICxUr' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create order' });
    }
});

// Verify Payment
app.post('/api/verify-payment', auth, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const crypto = require('crypto');
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'wpKHteId4ES6qmOSDxLyPp7q').update(body).digest('hex');
        
        if (expectedSignature === razorpay_signature) {
            const order = paymentOrders.find(o => o.orderId === razorpay_order_id);
            if (order) {
                const user = users.find(u => u.id === order.userId);
                user.balance += order.amount;
                transactions.push({
                    id: Date.now(),
                    userId: user.id,
                    amount: order.amount,
                    type: 'credit',
                    description: `Added via Razorpay`,
                    status: 'completed',
                    createdAt: new Date()
                });
                saveData();
            }
            res.json({ success: true });
        } else {
            res.status(400).json({ message: 'Invalid signature' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Send Money
app.post('/api/p2p/send', auth, async (req, res) => {
    const { amount, recipientEmail, note } = req.body;
    const sender = users.find(u => u.id === req.userId);
    const recipient = users.find(u => u.email === recipientEmail);
    
    if (!recipient) {
        return res.status(404).json({ message: 'Recipient not found' });
    }
    
    if (sender.balance < amount) {
        return res.status(400).json({ message: 'Insufficient balance' });
    }
    
    const sendAmount = parseFloat(amount);
    const transactionId = `TXN${Date.now()}`;
    
    sender.balance -= sendAmount;
    recipient.balance += sendAmount;
    
    transactions.push({
        id: transactionId,
        userId: sender.id,
        amount: sendAmount,
        type: 'debit',
        description: `Sent to ${recipient.email}${note ? ' - ' + note : ''}`,
        status: 'completed',
        createdAt: new Date()
    });
    
    transactions.push({
        id: transactionId + '_rec',
        userId: recipient.id,
        amount: sendAmount,
        type: 'credit',
        description: `Received from ${sender.email}${note ? ' - ' + note : ''}`,
        status: 'completed',
        createdAt: new Date()
    });
    
    saveData();
    
    const senderMessage = `💰 BHARATPAY 💰\n\nYou SENT: ₹${sendAmount.toFixed(2)}\nTo: ${recipient.name}\nNote: ${note || 'No note'}\nTxn ID: ${transactionId}\nBalance: ₹${sender.balance.toFixed(2)}\n\nThank you!`;
    const recipientMessage = `💰 BHARATPAY 💰\n\nYou RECEIVED: ₹${sendAmount.toFixed(2)}\nFrom: ${sender.name}\nSender Email: ${sender.email}\nSender Phone: ${sender.phone || 'Not provided'}\nNote: ${note || 'No note'}\nTxn ID: ${transactionId}\nBalance: ₹${recipient.balance.toFixed(2)}\n\nThank you!`;
    
    if (sender.phone && sender.phone.length >= 10) {
        await sendSMS(sender.phone, senderMessage);
    }
    
    if (recipient.phone && recipient.phone.length >= 10) {
        await sendSMS(recipient.phone, recipientMessage);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('💰 TRANSACTION COMPLETE');
    console.log('='.repeat(60));
    console.log(`From: ${sender.name} (${sender.email})`);
    console.log(`To: ${recipient.name} (${recipient.email})`);
    console.log(`Amount: ₹${sendAmount.toFixed(2)}`);
    console.log(`Note: ${note || 'No note'}`);
    console.log(`Transaction ID: ${transactionId}`);
    console.log(`Sender New Balance: ₹${sender.balance.toFixed(2)}`);
    console.log(`Recipient New Balance: ₹${recipient.balance.toFixed(2)}`);
    console.log('='.repeat(60) + '\n');
    
    res.json({ 
        success: true, 
        newBalance: sender.balance,
        message: `₹${sendAmount.toFixed(2)} sent to ${recipientEmail}`,
        transactionId: transactionId
    });
});

// Get Transactions
app.get('/api/payments/transactions', auth, (req, res) => {
    const userTransactions = transactions.filter(t => t.userId === req.userId);
    res.json({ success: true, transactions: userTransactions.reverse() });
});

// Get Payment Methods
app.get('/api/payment-methods', (req, res) => {
    res.json({
        success: true,
        methods: [
            { id: 'razorpay', name: 'Credit/Debit Card', icon: '💳' },
            { id: 'razorpay', name: 'UPI', icon: '📱' },
            { id: 'razorpay', name: 'NetBanking', icon: '🏦' }
        ]
    });
});

// Update profile
app.post('/api/user/update', auth, (req, res) => {
    const { phone } = req.body;
    const user = users.find(u => u.id === req.userId);
    if (user) {
        user.phone = phone;
        saveData();
        res.json({ success: true, message: 'Profile updated' });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
});

// Leaderboard
app.get('/api/leaderboard', (req, res) => {
    const leaderboard = users.map(u => ({ name: u.name, spent: u.totalSpent || 0 })).sort((a, b) => b.spent - a.spent).slice(0, 10).map((u, i) => ({ rank: i + 1, ...u }));
    res.json({ success: true, leaderboard });
});

// Credit Score
app.get('/api/credit-score', auth, (req, res) => {
    const user = users.find(u => u.id === req.userId);
    let score = 750;
    if (user.totalSpent > 50000) score += 50;
    let rating = score >= 800 ? 'Excellent' : score >= 700 ? 'Good' : 'Fair';
    res.json({ success: true, score, rating });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Root
app.get('/', (req, res) => {
    res.json({ 
        message: 'BharatPay API is running!',
        version: '1.0.0',
        status: 'active'
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 BharatPay Server running on port ${PORT}`);
    console.log(`💰 Default balance: ₹1,00,000`);
    console.log(`📱 REAL SMS via MSG91 ACTIVE!`);
    console.log(`✅ Server Ready for Production!`);
});
