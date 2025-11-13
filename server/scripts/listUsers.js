import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import connectDB from '../config/database.js';

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const listUsers = async () => {
  try {
    console.log('\n=== Users in Database ===\n');

    const users = await User.find().select('-password').sort({ createdAt: -1 });

    if (users.length === 0) {
      console.log('No users found in database.');
      process.exit(0);
    }

    console.log(`Total Users: ${users.length}\n`);
    console.log('='.repeat(80));

    // Separate super admins and other users
    const superAdmins = users.filter(u => u.role === 'super_admin');
    const otherUsers = users.filter(u => u.role !== 'super_admin');

    if (superAdmins.length > 0) {
      console.log('\n🔴 SUPER ADMINS:');
      console.log('-'.repeat(80));
      superAdmins.forEach((user, index) => {
        console.log(`\n${index + 1}. Super Admin:`);
        console.log(`   ID: ${user._id}`);
        console.log(`   Pharmacy Name: ${user.pharmacyName}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Phone: ${user.phone}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Active: ${user.isActive}`);
        console.log(`   Created: ${user.createdAt}`);
        if (user.subscription) {
          console.log(`   Subscription: ${user.subscription.plan || 'None'} - ${user.subscription.status || 'N/A'}`);
        }
      });
    }

    if (otherUsers.length > 0) {
      console.log('\n\n👥 OTHER USERS:');
      console.log('-'.repeat(80));
      otherUsers.forEach((user, index) => {
        console.log(`\n${index + 1}. User:`);
        console.log(`   ID: ${user._id}`);
        console.log(`   Pharmacy Name: ${user.pharmacyName}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Phone: ${user.phone}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Active: ${user.isActive}`);
        console.log(`   Created: ${user.createdAt}`);
        if (user.permissions && user.permissions.length > 0) {
          console.log(`   Permissions: ${user.permissions.join(', ')}`);
        }
        if (user.subscription) {
          console.log(`   Subscription: ${user.subscription.plan || 'None'} - ${user.subscription.status || 'N/A'}`);
        }
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\nSummary:`);
    console.log(`  - Super Admins: ${superAdmins.length}`);
    console.log(`  - Pharmacy Owners: ${users.filter(u => u.role === 'pharmacy_owner').length}`);
    console.log(`  - Technicians: ${users.filter(u => u.role === 'technician').length}`);
    console.log(`  - Staff: ${users.filter(u => u.role === 'staff').length}`);
    console.log(`  - Total: ${users.length}\n`);

    process.exit(0);
  } catch (error) {
    console.error('Error listing users:', error);
    process.exit(1);
  }
};

listUsers();
