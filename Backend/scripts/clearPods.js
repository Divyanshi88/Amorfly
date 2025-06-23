const mongoose = require('mongoose');

// ✅ Use this if you're running MongoDB locally
const MONGO_URI = 'mongodb://127.0.0.1:27017/amorfly';

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  const result = await mongoose.connection.db.collection('pods').deleteMany({});
  console.log(`✅ Deleted Pods: ${result.deletedCount}`);
  process.exit(0);
}).catch(err => {
  console.error('❌ Error deleting pods:', err.message);
  process.exit(1);
});
