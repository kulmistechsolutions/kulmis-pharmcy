import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import connectDB from '../config/database.js';

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const createSuperAdmin = async () => {
  try {
    const { pharmacyName, email, phone, password } = process.env;

    if (!pharmacyName || !email || !phone || !password) {
      console.error('❌ Missing required environment variables:');
      console.error('Required: PHARMACY_NAME, EMAIL, PHONE, PASSWORD');
      console.error('\nExample:');
      console.error('PHARMACY_NAME="Admin Pharmacy"');
      console.error('EMAIL="admin@example.com"');
      console.error('PHONE="+1234567890"');
      console.error('PASSWORD="admin123"');
      process.exit(1);
    }

    // Check if super admin already exists
    const existingAdmin = await User.findOne({ role: 'super_admin' });
    if (existingAdmin) {
      console.log('⚠️  Super admin already exists:', existingAdmin.email);
      console.log('To create a new one, delete the existing super admin first.');
      process.exit(0);
    }

    // Check if user with email/phone exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      console.error('❌ User with this email or phone already exists');
      process.exit(1);
    }

    // Create super admin
    const superAdmin = await User.create({
      pharmacyName,
      email,
      phone,
      password,
      role: 'super_admin',
      isActive: true,
    });

    console.log('✅ Super admin created successfully!');
    console.log('Email:', superAdmin.email);
    console.log('Phone:', superAdmin.phone);
    console.log('Role:', superAdmin.role);
    console.log('\nYou can now login with these credentials.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating super admin:', error.message);
    process.exit(1);
  }
};

// Run the script
createSuperAdmin();













