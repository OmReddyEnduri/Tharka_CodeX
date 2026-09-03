const mongoose = require('mongoose');
const User = require('./models/User');
const { createClerkClient } = require('@clerk/clerk-sdk-node');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const email = 'ramanji36@gmail.com';

async function setAdmin() {
  try {
    // 1. Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 2. Find user in Clerk
    console.log(`Looking up user ${email} in Clerk...`);
    const userList = await clerkClient.users.getUserList({
      emailAddress: [email],
    });

    // Handle Clerk response structure (might be array or object with data)
    const users = Array.isArray(userList) ? userList : userList.data;

    if (!users || users.length === 0) {
      console.error('User not found in Clerk');
      process.exit(1);
    }

    const clerkUser = users[0];
    const clerkId = clerkUser.id;
    console.log(`Found Clerk User ID: ${clerkId}`);

    // 3. Update User in MongoDB
    console.log('Updating user role in MongoDB...');
    // We use upsert to ensure the record exists even if they haven't logged in to our app yet but exist in Clerk
    const user = await User.findOneAndUpdate(
      { clerkId: clerkId },
      { $set: { role: 'admin' } },
      { new: true, upsert: true } 
    );

    console.log('User updated successfully:');
    console.log(user);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

setAdmin();
