const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { User, AuditLog } = require('../models');
const logger = require('../utils/logger');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '24h' }
  );
};

const logAudit = async (userId, action, resource, req, status = 'success', metadata = {}) => {
  try {
    await AuditLog.create({
      userId,
      action,
      resource,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      status,
      metadata
    });
  } catch (error) {
    logger.error('Audit log error:', error);
  }
};

// Register new user
exports.register = async (req, res, next) => {
  try {
    const { fullName, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        type: 'https://httpstatuses.com/409',
        title: 'Conflict',
        status: 409,
        detail: 'Email already registered'
      });
    }

    // Create user
    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      passwordHash: password,
      role: 'analyst'
    });

    const token = generateToken(user._id);

    await logAudit(user._id, 'create', 'user', req, 'success', { email: user.email });

    res.status(201).json({
      message: 'Registration successful',
      user: user.toJSON(),
      token
    });
  } catch (error) {
    next(error);
  }
};

// Login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user with password field
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    
    if (!user) {
      await logAudit(null, 'login', 'auth', req, 'failure', { email, reason: 'User not found' });
      return res.status(401).json({
        type: 'https://httpstatuses.com/401',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      await logAudit(user._id, 'login', 'auth', req, 'failure', { reason: 'Account deactivated' });
      return res.status(401).json({
        type: 'https://httpstatuses.com/401',
        title: 'Unauthorized',
        status: 401,
        detail: 'Account has been deactivated'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await logAudit(user._id, 'login', 'auth', req, 'failure', { reason: 'Invalid password' });
      return res.status(401).json({
        type: 'https://httpstatuses.com/401',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid email or password'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    await logAudit(user._id, 'login', 'auth', req, 'success');

    res.json({
      message: 'Login successful',
      user: user.toJSON(),
      token
    });
  } catch (error) {
    next(error);
  }
};

// Logout
exports.logout = async (req, res, next) => {
  try {
    await logAudit(req.user._id, 'logout', 'auth', req);
    
    res.json({
      message: 'Logout successful'
    });
  } catch (error) {
    next(error);
  }
};

// Get current user profile
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ user });
  } catch (error) {
    next(error);
  }
};

// Change password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+passwordHash');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: 'Current password is incorrect'
      });
    }

    user.passwordHash = newPassword;
    await user.save();

    await logAudit(user._id, 'update', 'user', req, 'success', { field: 'password' });

    res.json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Google OAuth Login
exports.googleLogin = async (req, res, next) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: 'Google credential is required'
      });
    }

    // Verify the Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;

    // Find or create user
    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Create new user from Google account
      user = await User.create({
        fullName: name,
        email: email.toLowerCase(),
        passwordHash: `google_${googleId}_${Date.now()}`, // Random password for Google users
        role: 'analyst',
        googleId
      });
      
      await logAudit(user._id, 'create', 'user', req, 'success', { method: 'google', email: user.email });
    } else if (!user.isActive) {
      return res.status(401).json({
        type: 'https://httpstatuses.com/401',
        title: 'Unauthorized',
        status: 401,
        detail: 'Account has been deactivated'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    await logAudit(user._id, 'login', 'auth', req, 'success', { method: 'google' });

    res.json({
      message: 'Google login successful',
      user: user.toJSON(),
      token
    });
  } catch (error) {
    logger.error('Google login error:', error);
    
    if (error.message.includes('Token used too late') || error.message.includes('Invalid token')) {
      return res.status(401).json({
        type: 'https://httpstatuses.com/401',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid or expired Google token'
      });
    }
    
    next(error);
  }
};
