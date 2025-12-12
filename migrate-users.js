const mongoose = require('mongoose');
require('dotenv').config();

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true, lowercase: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, default: '' },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    deposits: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    verificationMethod: { type: String, default: '' }, // Ensure this is included
    pendingVacations: { type: Array, default: [] },
    upcomingVacations: { type: Array, default: [] },
    completedVacations: { type: Array, default: [] },
    transactions: { type: Array, default: [] },
    usageHistory: { type: Array, default: [] },
    profilePic: { type: String, default: 'images/default-pic.jpg' },
    pendingDeposits: { type: Array, default: [] },
    lastDepositAccepted: { type: Object, default: {} },
    personalInfo: {
        phone: { type: String, default: 'Not set' },
        address: { type: String, default: 'Not set' }
    },
    role: { type: String, default: 'user' }
});

const User = mongoose.model('User', userSchema);

async function migrateUsers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const result = await User.updateMany(
            { verificationMethod: { $exists: false } },
            { $set: { verificationMethod: '' } }
        );

        console.log(`Updated ${result.modifiedCount} users`);
    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        mongoose.connection.close();
    }
}

migrateUsers();