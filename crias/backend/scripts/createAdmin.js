/**
 * Bootstrap / promote an admin user.
 *
 * Usage (from the crias/ or crias/backend/ directory, with MONGODB_URI set):
 *   node backend/scripts/createAdmin.js "Admin Name" admin@example.com "StrongPass123"
 *
 * Or via environment variables:
 *   ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD
 *
 * If the email already exists, the account is promoted to the admin role
 * (and reactivated). Otherwise a new admin user is created.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function main() {
  const [, , argName, argEmail, argPassword] = process.argv;
  const fullName = argName || process.env.ADMIN_NAME || 'CRIAS Admin';
  const email = (argEmail || process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const password = argPassword || process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Missing email/password. Provide as args or ADMIN_EMAIL/ADMIN_PASSWORD env vars.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  let user = await User.findOne({ email });
  if (user) {
    user.role = 'admin';
    user.isActive = true;
    user.passwordHash = password; // re-hashed by the pre-save hook
    await user.save();
    console.log(`Promoted existing user to admin: ${email}`);
  } else {
    user = await User.create({ fullName, email, passwordHash: password, role: 'admin' });
    console.log(`Created admin user: ${email}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to create admin:', err.message);
  process.exit(1);
});
