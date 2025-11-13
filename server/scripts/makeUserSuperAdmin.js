import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import connectDB from '../config/database.js';
import readline from 'readline';

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

const makeUserSuperAdmin = async () => {
  try {
    console.log('\n=== Make User Super Admin Tool ===\n');

    // Get user identifier
    const identifier = await question('Enter user email or phone number: ');

    if (!identifier) {
      console.error('\n❌ Email or phone number is required!');
      rl.close();
      process.exit(1);
    }

    // Find user
    const user = await User.findOne({ 
      $or: [
        { email: identifier },
        { phone: identifier }
      ]
    });

    if (!user) {
      console.error('\n❌ User not found!');
      console.error('Please check the email or phone number and try again.');
      rl.close();
      process.exit(1);
    }

    // Show current user info
    console.log('\n📋 Current User Information:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Pharmacy Name:', user.pharmacyName);
    console.log('Email:', user.email);
    console.log('Phone:', user.phone);
    console.log('Current Role:', user.role);
    console.log('Status:', user.isActive ? 'Active' : 'Inactive');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (user.role === 'super_admin') {
      console.log('\n✅ User is already a super admin!');
      rl.close();
      process.exit(0);
    }

    // Confirm
    const confirm = await question('\n⚠️  Do you want to make this user a super admin? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('Cancelled.');
      rl.close();
      process.exit(0);
    }

    // Update user to super admin
    user.role = 'super_admin';
    user.isActive = true;
    await user.save();

    console.log('\n✅ User successfully updated to super admin!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Pharmacy Name:', user.pharmacyName);
    console.log('Email:', user.email);
    console.log('Phone:', user.phone);
    console.log('New Role:', user.role);
    console.log('Status:', user.isActive ? 'Active' : 'Inactive');
    console.log('Updated At:', user.updatedAt);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ User can now login and access admin features.\n');

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error updating user:', error.message);
    rl.close();
    process.exit(1);
  }
};

// Run the script
makeUserSuperAdmin();













