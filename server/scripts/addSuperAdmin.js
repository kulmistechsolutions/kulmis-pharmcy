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

const addSuperAdmin = async () => {
  try {
    console.log('\n=== Super Admin Creation Tool ===\n');

    // Get user input
    const pharmacyName = await question('Enter Pharmacy Name: ');
    const email = await question('Enter Email: ');
    const phone = await question('Enter Phone Number: ');
    const password = await question('Enter Password (min 6 characters): ');

    if (!pharmacyName || !email || !phone || !password) {
      console.error('\n❌ All fields are required!');
      rl.close();
      process.exit(1);
    }

    if (password.length < 6) {
      console.error('\n❌ Password must be at least 6 characters!');
      rl.close();
      process.exit(1);
    }

    // Check if super admin already exists
    const existingAdmin = await User.findOne({ role: 'super_admin' });
    if (existingAdmin) {
      console.log('\n⚠️  Super admin already exists:', existingAdmin.email);
      const proceed = await question('Do you want to create another super admin? (y/n): ');
      if (proceed.toLowerCase() !== 'y') {
        console.log('Cancelled.');
        rl.close();
        process.exit(0);
      }
    }

    // Check if user with email/phone exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      console.error('\n❌ User with this email or phone already exists!');
      console.error('Email:', existingUser.email);
      console.error('Phone:', existingUser.phone);
      rl.close();
      process.exit(1);
    }

    // Create super admin
    console.log('\n⏳ Creating super admin...');
    const superAdmin = await User.create({
      pharmacyName,
      email,
      phone,
      password,
      role: 'super_admin',
      isActive: true,
    });

    console.log('\n✅ Super admin created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Pharmacy Name:', superAdmin.pharmacyName);
    console.log('Email:', superAdmin.email);
    console.log('Phone:', superAdmin.phone);
    console.log('Role:', superAdmin.role);
    console.log('Status:', superAdmin.isActive ? 'Active' : 'Inactive');
    console.log('Created At:', superAdmin.createdAt);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ You can now login with these credentials.\n');

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating super admin:', error.message);
    rl.close();
    process.exit(1);
  }
};

// Run the script
addSuperAdmin();














