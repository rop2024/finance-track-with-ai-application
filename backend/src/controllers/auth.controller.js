const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { apiResponse } = require('../utils/apiResponse');

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json(apiResponse.error('User already exists with this email'));
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json(apiResponse.success('User registered successfully', {
      user: userResponse,
      token
    }));
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json(apiResponse.error('Registration failed'));
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json(apiResponse.error('Invalid credentials'));
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json(apiResponse.error('Invalid credentials'));
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json(apiResponse.success('Login successful', {
      user: userResponse,
      token
    }));
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json(apiResponse.error('Login failed'));
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = req.user;
    res.json(apiResponse.success('User retrieved successfully', { user }));
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json(apiResponse.error('Failed to get user'));
  }
};

const logout = async (req, res) => {
  try {
    // In a stateless JWT system, logout is handled on the client side
    // by removing the token. We can optionally implement token blacklisting here.
    res.json(apiResponse.success('Logged out successfully'));
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json(apiResponse.error('Logout failed'));
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  logout
};
