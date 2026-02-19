const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/finance_app', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Create indexes
    await createIndexes();

  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const createIndexes = async () => {
  const db = mongoose.connection;
  
  // Ensure all indexes are created
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('transactions').createIndex({ userId: 1, date: -1 });
  await db.collection('transactions').createIndex({ userId: 1, categoryId: 1 });
  await db.collection('aisuggestions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  
  console.log('Database indexes created');
};

module.exports = connectDB;