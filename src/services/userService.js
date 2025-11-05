const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ConflictError, AuthenticationError, ValidationError } = require('../utils/errors');

const generateToken = (id) => {
  try {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  } catch (error) {
    throw new Error('Token generation failed');
  }
};

const registerUser = async (userData) => {
  try {
    const { name, email, password, role } = userData;

    const userExists = await User.findOne({ email });
    if (userExists) {
      throw new ConflictError('User already exists');
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'user',
    });

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    };
  } catch (error) {
    if (error.name === 'ValidationError') {
      throw new ValidationError(error.message);
    }
    throw error;
  }
};

const loginUser = async (email, password) => {
  try {
    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const user = await User.findOne({ email });
    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AuthenticationError('Invalid credentials');
    }

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    };
  } catch (error) {
    throw error;
  }
};

module.exports = { registerUser, loginUser };
