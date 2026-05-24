import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

const API_URL = 'http://localhost:5000/api';

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('send');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');  // ADD PHONE STATE
  
  // Money Send states
  const [sendAmount, setSendAmount] = useState('');
  const [receiverEmail, setReceiverEmail] = useState('');
  const [sendNote, setSendNote] = useState('');
  
  // Add Money states
  const [addAmount, setAddAmount] = useState('');
  const [isRazorpayLoaded, setIsRazorpayLoaded] = useState(false);

  const [leaderboard, setLeaderboard] = useState([]);
  const [creditScore, setCreditScore] = useState(null);

  // Load Razorpay script
  useEffect(() => {
    const loadRazorpayScript = () => {
      return new Promise((resolve) => {
        if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
          resolve(true);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => {
          console.log('Razorpay script loaded');
          resolve(true);
        };
        script.onerror = () => {
          console.log('Failed to load Razorpay script');
          resolve(false);
        };
        document.body.appendChild(script);
      });
    };
    
    loadRazorpayScript().then((loaded) => {
      setIsRazorpayLoaded(loaded);
      if (loaded) {
        console.log('✅ Razorpay SDK ready');
      }
    });
  }, []);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchDashboard();
      fetchTransactions();
      fetchLeaderboard();
      fetchCreditScore();
    }
  }, [token]);

  const fetchDashboard = async () => {
    try {
      const response = await axios.get(`${API_URL}/dashboard/stats`);
      if (response.data.success) {
        setUser(response.data.stats);
        setBalance(response.data.stats.balance);
      }
    } catch (error) {
      console.error('Dashboard error:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await axios.get(`${API_URL}/payments/transactions`);
      if (response.data.success) {
        setTransactions(response.data.transactions || []);
      }
    } catch (error) {
      console.error('Transactions error:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await axios.get(`${API_URL}/leaderboard`);
      setLeaderboard(response.data.leaderboard || []);
    } catch (error) {
      console.error('Leaderboard error:', error);
    }
  };

  const fetchCreditScore = async () => {
    try {
      const response = await axios.get(`${API_URL}/credit-score`);
      setCreditScore(response.data);
    } catch (error) {
      console.error('Credit score error:', error);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/register`, { 
        name, 
        email, 
        password,
        phone  // SEND PHONE NUMBER TO BACKEND
      });
      localStorage.setItem('token', response.data.token);
      setToken(response.data.token);
      setUser(response.data.user);
      setBalance(response.data.user.balance);
      toast.success('Registration successful! 📱 Phone number saved');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password });
      localStorage.setItem('token', response.data.token);
      setToken(response.data.token);
      setUser(response.data.user);
      setBalance(response.data.user.balance);
      toast.success('Login successful!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    toast.success('Logged out successfully');
  };

  const sendMoney = async () => {
    if (!sendAmount || sendAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!receiverEmail) {
      toast.error('Please enter receiver email');
      return;
    }
    if (parseFloat(sendAmount) > balance) {
      toast.error('Insufficient balance');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/p2p/send`, {
        amount: parseFloat(sendAmount),
        recipientEmail: receiverEmail,
        note: sendNote
      });
      toast.success(`₹${sendAmount} sent to ${receiverEmail}!`);
      setSendAmount('');
      setReceiverEmail('');
      setSendNote('');
      fetchDashboard();
      fetchTransactions();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Send money failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMoney = async () => {
    if (!addAmount || addAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!isRazorpayLoaded) {
      toast.error('Payment system is loading. Please wait...');
      return;
    }

    setLoading(true);
    
    try {
      const orderResponse = await axios.post(`${API_URL}/create-order`, {
        amount: parseFloat(addAmount),
        currency: 'INR'
      });

      const options = {
        key: orderResponse.data.keyId,
        amount: orderResponse.data.amount * 100,
        currency: 'INR',
        name: 'BharatPay',
        description: `Add ₹${addAmount} to wallet`,
        order_id: orderResponse.data.orderId,
        handler: async (response) => {
          try {
            const verifyResponse = await axios.post(`${API_URL}/verify-payment`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });
            
            if (verifyResponse.data.success) {
              toast.success(`₹${addAmount} added successfully!`);
              setAddAmount('');
              fetchDashboard();
              fetchTransactions();
            } else {
              toast.error('Payment verification failed');
            }
          } catch (error) {
            console.error('Verification error:', error);
            toast.error('Payment verification failed');
          }
        },
        prefill: {
          name: user?.name || 'BharatPay User',
          email: user?.email || 'user@example.com',
        },
        theme: {
          color: '#FF9933',
          background: '#FFFFFF'
        },
        modal: {
          ondismiss: function() {
            toast.info('Payment cancelled');
          }
        }
      };
      
      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error.response?.data?.message || 'Failed to initiate payment');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1 className="auth-title">🇮🇳 BharatPay</h1>
          <p className="auth-subtitle">Real Payment Gateway | UPI | Cards | NetBanking</p>
          <div className="auth-toggle">
            <button className={isLogin ? 'active' : ''} onClick={() => setIsLogin(true)}>Login</button>
            <button className={!isLogin ? 'active' : ''} onClick={() => setIsLogin(false)}>Register</button>
          </div>
          {isLogin ? (
            <form onSubmit={handleLogin}>
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="submit" disabled={loading}>{loading ? 'Loading...' : 'Login'}</button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <input 
                type="text" 
                placeholder="Full Name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
              />
              <input 
                type="email" 
                placeholder="Email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
              {/* PHONE NUMBER FIELD - ADDED HERE */}
              <input 
                type="tel" 
                placeholder="Phone Number (for notifications)" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                required 
              />
              <input 
                type="password" 
                placeholder="Password (min 6)" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                minLength="6"
              />
              <button type="submit" disabled={loading}>{loading ? 'Loading...' : 'Register'}</button>
            </form>
          )}
          <Toaster position="top-right" />
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="navbar">
        <h2>🇮🇳 BharatPay</h2>
        <div className="nav-controls">
          <div className="balance-card">💰 ₹{balance.toFixed(2)}</div>
          <div className="nav-tabs">
            <button className={`nav-btn ${activeTab === 'send' ? 'active' : ''}`} onClick={() => setActiveTab('send')}>💸 Send</button>
            <button className={`nav-btn ${activeTab === 'add' ? 'active' : ''}`} onClick={() => setActiveTab('add')}>➕ Add Money</button>
            <button className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>📜 History</button>
            <button className={`nav-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>👤 Profile</button>
          </div>
          <button onClick={handleLogout} className="logout-btn">🚪 Logout</button>
        </div>
      </div>

      <div className="main-content">
        {activeTab === 'send' && (
          <div className="send-money-section">
            <div className="send-card">
              <div className="send-header">
                <div className="send-icon">💸</div>
                <h2>Send Money</h2>
                <p>Instant transfer to any BharatPay user</p>
              </div>
              
              <div className="send-form">
                <div className="input-group">
                  <label>💰 Amount (₹)</label>
                  <input type="number" placeholder="Enter amount" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} />
                </div>

                <div className="input-group">
                  <label>📧 Receiver Email</label>
                  <input type="email" placeholder="friend@example.com" value={receiverEmail} onChange={(e) => setReceiverEmail(e.target.value)} />
                </div>

                <div className="input-group">
                  <label>📝 Note (Optional)</label>
                  <input type="text" placeholder="What's this for?" value={sendNote} onChange={(e) => setSendNote(e.target.value)} />
                </div>

                <div className="send-info">
                  <div className="info-item"><span>Your Balance:</span><strong>₹{balance.toFixed(2)}</strong></div>
                  <div className="info-item"><span>After Transfer:</span><strong>₹{(balance - (parseFloat(sendAmount) || 0)).toFixed(2)}</strong></div>
                </div>

                <button className="send-btn" onClick={sendMoney} disabled={loading}>
                  {loading ? 'Sending...' : `💸 Send ₹${sendAmount || '0'}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'add' && (
          <div className="add-money-section">
            <div className="add-card">
              <div className="add-header">
                <div className="add-icon">➕</div>
                <h2>Add Money to Wallet</h2>
                <p>Secured by Razorpay | Test Mode</p>
              </div>

              <div className="input-group">
                <label>💰 Amount (₹)</label>
                <input type="number" placeholder="Enter amount" value={addAmount} onChange={(e) => setAddAmount(e.target.value)} />
              </div>

              <div className="test-card-info">
                <h4>💳 Test Card Details:</h4>
                <p>Card: <strong>4111 1111 1111 1111</strong></p>
                <p>Expiry: <strong>12/28</strong> | CVV: <strong>123</strong></p>
                <p>OTP: <strong>123456</strong></p>
              </div>

              <button className="add-btn" onClick={handleAddMoney} disabled={loading}>
                {loading ? 'Processing...' : `💳 Pay ₹${addAmount || '0'} via Razorpay`}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-section">
            <h2>📜 Transaction History</h2>
            {transactions.length === 0 ? (
              <div className="empty-history">No transactions yet</div>
            ) : (
              <div className="transactions-list">
                {transactions.map(tx => (
                  <div key={tx.id} className="transaction-item">
                    <div className="tx-icon">{tx.type === 'credit' ? '💰' : '💸'}</div>
                    <div className="tx-details">
                      <div className="tx-description">{tx.description}</div>
                      <div className="tx-date">{new Date(tx.createdAt).toLocaleString()}</div>
                    </div>
                    <div className={`tx-amount ${tx.type === 'credit' ? 'credit' : 'debit'}`}>
                      {tx.type === 'credit' ? '+' : '-'}₹{tx.amount.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="profile-section">
            <div className="profile-card">
              <div className="profile-avatar">👤</div>
              <h2>{user?.name}</h2>
              <p className="profile-email">{user?.email}</p>
              <p className="profile-phone">📱 {user?.phone || 'No phone added'}</p>
              
              <div className="profile-stats">
                <div className="profile-stat"><span>💰 Balance</span><strong>₹{balance.toFixed(2)}</strong></div>
                <div className="profile-stat"><span>📊 Transactions</span><strong>{transactions.length}</strong></div>
                <div className="profile-stat"><span>📈 Credit Score</span><strong>{creditScore?.score || 'N/A'}</strong></div>
              </div>
            </div>

            <div className="leaderboard-card">
              <h3>🏆 Top Spenders</h3>
              {leaderboard.map((u, i) => (
                <div key={i} className="leaderboard-item">
                  <span className="rank">#{u.rank}</span>
                  <span className="name">{u.name}</span>
                  <span className="amount">₹{u.spent?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
