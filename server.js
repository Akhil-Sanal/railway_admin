require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const transactionRoutes = require('./routes/transactions');
const analyticsRoutes = require('./routes/analytics');
const reportRoutes = require('./routes/reports');

app.use('/api/transactions', transactionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚂 Railway Admin Server running at http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}\n`);
});
