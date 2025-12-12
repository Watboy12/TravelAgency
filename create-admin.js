const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Was: require('bcrypt')
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
    pendingVacations: { type: Array, default: [] },
    upcomingVacations: { type: Array, default: [] },
    completedVacations: { type: Array, default: [] },
    transactions: { type: Array, default: [] },
    usageHistory: { type: Array, default: [] },
    profilePic: { type: String, default: 'images/default-pic.jpg' },
    verified: { type: Boolean, default: false },
    pendingDeposits: { type: Array, default: [] },
    lastDepositAccepted: { type: Object, default: {} },
    personalInfo: {
        email: String,
        phone: { type: String, default: 'Not set' },
        address: { type: String, default: 'Not set' }
    },
    role: { type: String, default: 'user' }
});

const User = mongoose.model('User', userSchema);

async function createAdmin() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const existingAdmin = await User.findOne({ username: 'admin' });
        if (existingAdmin) {
            console.log('Admin user already exists');
            return;
        }
        const hashedPassword = await bcrypt.hash('adminpassword123', 10);
        const admin = new User({
            name: 'Admin',
            username: 'admin',
            email: 'admin@example.com',
            password: hashedPassword,
            role: 'admin'
        });
        await admin.save();
        console.log('Admin user created');
    } catch (err) {
        console.error('Error creating admin:', err);
    } finally {
        mongoose.connection.close();
    }
}

createAdmin();