import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import connectDB from '../config/database.js';

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const addSuperAdmin = async () => {
  try {
    // Default super admin credentials (change these as needed)
    const superAdminData = {
      pharmacyName: 'Admin Pharmacy',
      email: 'admin@kulmis.com',
      phone: '+1234567890',
      password: 'admin123456', // Change this password after first login!
      role: 'super_admin',
      isActive: true,
    };

    console.log('\n=== Adding Super Admin to Database ===\n');

    // Check if super admin already exists
    const existingAdmin = await User.findOne({ role: 'super_admin', email: superAdminData.email });
    if (existingAdmin) {
      console.log('✅ Super admin already exists with email:', superAdminData.email);
      console.log('If you want to create a new one, use a different email.\n');
      process.exit(0);
    }

    // Check if user with email/phone exists
    const existingUser = await User.findOne({ 
      $or: [
        { email: superAdminData.email }, 
        { phone: superAdminData.phone }
      ] 
    });
    
    if (existingUser) {
      console.log('⚠️  User with this email or phone already exists.');
      console.log('Updating existing user to super admin...\n');
      
      existingUser.role = 'super_admin';
      existingUser.isActive = true;
      if (existingUser.password !== superAdminData.password) {
        // Only update password if different
        existingUser.password = superAdminData.password;
      }
      await existingUser.save();
      
      console.log('✅ Existing user updated to super admin!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Email:', existingUser.email);
      console.log('Phone:', existingUser.phone);
      console.log('Role:', existingUser.role);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      process.exit(0);
    }

    // Create new super admin
    console.log('Creating new super admin...\n');
    const superAdmin = await User.create(superAdminData);

    console.log('✅ Super admin created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Pharmacy Name:', superAdmin.pharmacyName);
    console.log('Email:', superAdmin.email);
    console.log('Phone:', superAdmin.phone);
    console.log('Password:', superAdminData.password, '(Change this after first login!)');
    console.log('Role:', superAdmin.role);
    console.log('Status:', superAdmin.isActive ? 'Active' : 'Inactive');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  IMPORTANT: Change the password after first login!\n');
    console.log('You can now login with:');
    console.log('Email:', superAdmin.email);
    console.log('Password:', superAdminData.password);
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
};

// Run the script
addSuperAdmin();














