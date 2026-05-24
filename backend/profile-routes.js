// Add this to your existing server.js before app.listen()

// User Profile endpoints
let userProfiles = [];

app.get('/api/user/profile', verifyToken, (req, res) => {
    let profile = userProfiles.find(p => p.userId === req.userId);
    if (!profile) {
        profile = { userId: req.userId, phone: '', address: '', city: '', pincode: '', panCard: '', aadhaar: '' };
    }
    res.json({ success: true, profile });
});

app.post('/api/user/profile', verifyToken, (req, res) => {
    const existingIndex = userProfiles.findIndex(p => p.userId === req.userId);
    const profileData = { userId: req.userId, ...req.body };
    if (existingIndex >= 0) {
        userProfiles[existingIndex] = profileData;
    } else {
        userProfiles.push(profileData);
    }
    res.json({ success: true, message: 'Profile updated' });
});

// Contact endpoints
let contactMessages = [];

app.post('/api/contact/send', (req, res) => {
    const message = { id: Date.now(), ...req.body, createdAt: new Date() };
    contactMessages.push(message);
    res.json({ success: true, message: 'Message sent successfully' });
});

console.log('✅ Profile and Contact routes added');
