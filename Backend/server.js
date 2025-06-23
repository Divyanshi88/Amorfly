console.log("🚀 Amor Fly server.js starting...");

// 🛠️ Core dependencies
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const { createServer } = require('http');
const { Server } = require('socket.io');
const progressRoutes = require('./routes/progress');
const cron = require('node-cron');
const User = require('./models/User');


// 🔐 Load environment variables
dotenv.config();

// ✅ Validate critical env variables
if (!process.env.MONGODB_URI) {
  console.error("❌ MONGODB_URI not found in .env file");
  process.exit(1);
}

// ⚙️ App and server setup
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // 🔒 Consider restricting in production
  },
});

// 🚪 Port config
const PORT = process.env.PORT || 5000;

// 🌐 MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected'))
.catch((err) => {
  console.error('❌ MongoDB connection error:', err.message);
  process.exit(1);
});

// 🧩 Middleware
app.use(cors());
app.use(express.json());

// 📊 Log all incoming requests
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.originalUrl}`);
  next();
});

// 🏁 Health check
app.get('/', (req, res) => {
  res.send('💡 Amor Fly backend is up and running!');
});

// 📦 Route handler imports
let authRoutes, podRoutes, skillRoutes, connectionRoutes, analyticsRoutes;

try {
  console.log('📂 Loading routes...');
  authRoutes = require('./routes/auth');
  podRoutes = require('./routes/pods');
  skillRoutes = require('./routes/skills');
  connectionRoutes = require('./routes/connections'); // ✅ Connections
  analyticsRoutes = require('./routes/analytics');     // ✅ Analytics
  console.log('✅ Routes loaded successfully');
} catch (err) {
  console.error('❌ Error loading routes:', err.message);
  process.exit(1);
}

try {
  app.use('/api/auth', authRoutes);
  app.use('/api/pods', podRoutes);
  app.use('/api/skills', skillRoutes);
  app.use('/api/connections', connectionRoutes); // ✅ Mounting connections
  app.use('/api/analytics', analyticsRoutes);    // ✅ Correct for analytics
  app.use('/api/progress', progressRoutes);      // ✅ Correct for progress
  console.log('✅ Routes mounted successfully');
} catch (err) {
  console.error('❌ Error mounting routes:', err.message);
  process.exit(1);
}


// 🧯 Catch-all error handler
app.use((err, req, res, next) => {
  console.error('💥 Unhandled error:', err.stack);
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// ❓ 404 Route handler
app.use('*', (req, res) => {
  console.log('❓ 404 - Route not found:', req.originalUrl);
  res.status(404).json({ message: 'Route not found' });
});

// 📡 Socket.io setup
io.on('connection', (socket) => {
  console.log('📶 New socket connection established');

  socket.on('joinPod', (podId) => {
    console.log('👥 User joined pod room:', podId);
    socket.join(podId);
  });

  socket.on('sendMessage', ({ podId, message }) => {
    console.log(`💬 Message sent to pod ${podId}`);
    io.to(podId).emit('receiveMessage', message);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Socket disconnected');
  });
});
// 🗓️ Weekly Progress Reset - Every Monday at 12:00 AM
cron.schedule('* * * * *', async () => {
  console.log('🔄 Running weekly progress reset...');

  try {
    const users = await User.find();

    for (const user of users) {
      if (user.progress) {
        user.progress.messages = 0;
        user.progress.resources = 0;
        user.progress.points = 0;
      }

      user.weeklyConnectionsLeft = 1;
      user.nextWeeklyReset = new Date(new Date().setDate(new Date().getDate() + 7));

      await user.save();
    }

    console.log('✅ Weekly reset completed for all users.');
  } catch (error) {
    console.error('❌ Weekly reset failed:', error);
  }
});

// 🟢 Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('📋 Endpoints available:');
  console.table([
  { Method: 'GET', Route: '/' },
  { Method: 'POST', Route: '/api/auth/register' },
  { Method: 'POST', Route: '/api/auth/login' },
  { Method: 'GET', Route: '/api/auth/me' },
  { Method: 'POST', Route: '/api/pods/join' },
  { Method: 'GET', Route: '/api/pods/my-pod' },
  { Method: 'POST', Route: '/api/pods/:podId/messages' },
  { Method: 'GET', Route: '/api/pods/:podId/messages' },
  { Method: 'GET', Route: '/api/pods/test' },
  { Method: 'GET', Route: '/api/connections/discover' },
  { Method: 'GET', Route: '/api/analytics/community' },
  { Method: 'GET', Route: '/api/analytics/user' },
  { Method: 'GET', Route: '/api/connections/eligibility' },
  { Method: 'GET', Route: '/api/skills' },
  { Method: 'GET/POST', Route: '/api/progress' }, // ✅ Add this based on your progress router
]);
});

module.exports = { app, httpServer, io };
