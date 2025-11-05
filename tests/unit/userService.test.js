const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { registerUser, loginUser } = require('../../src/services/userService');
const User = require('../../src/models/User');
const { ConflictError, AuthenticationError } = require('../../src/utils/errors');

jest.mock('../../src/models/User');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('User Service', () => {
  describe('registerUser', () => {
    it('should register a new user successfully', async () => {
      const mongoose = require('mongoose');
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'user',
      };

      const mockUserId = new mongoose.Types.ObjectId();
      const mockUser = {
        _id: mockUserId,
        name: userData.name,
        email: userData.email,
        role: 'user',
      };

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue(mockUser);

      const result = await registerUser(userData);

      expect(result).toHaveProperty('_id');
      expect(result).toHaveProperty('token');
      expect(result.name).toBe(userData.name);
      expect(result.email).toBe(userData.email);
      expect(result.role).toBe('user');
      expect(result).not.toHaveProperty('password');
    });

    it('should hash the password before saving', async () => {
      const userData = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'password123',
      };

      const mockUser = {
        _id: '507f1f77bcf86cd799439012',
        name: userData.name,
        email: userData.email,
        role: 'user',
      };

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue(mockUser);

      await registerUser(userData);

      expect(User.create).toHaveBeenCalled();
      const createCall = User.create.mock.calls[0][0];
      expect(createCall.password).toBeDefined();
    });

    it('should throw ConflictError for duplicate email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
      };

      const existingUser = {
        _id: '507f1f77bcf86cd799439011',
        email: userData.email,
      };

      User.findOne.mockResolvedValue(existingUser);

      await expect(registerUser(userData)).rejects.toThrow(ConflictError);
      await expect(registerUser(userData)).rejects.toThrow('User already exists');
    });

    it('should default role to user if not provided', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        _id: '507f1f77bcf86cd799439013',
        name: userData.name,
        email: userData.email,
        role: 'user',
      };

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue(mockUser);

      const user = await registerUser(userData);
      expect(user.role).toBe('user');
    });

    it('should allow admin role when specified', async () => {
      const userData = {
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin',
      };

      const mockUser = {
        _id: '507f1f77bcf86cd799439014',
        name: userData.name,
        email: userData.email,
        role: 'admin',
      };

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue(mockUser);

      const user = await registerUser(userData);
      expect(user.role).toBe('admin');
    });
  });

  describe('loginUser', () => {
    it('should login user with correct credentials', async () => {
      const mongoose = require('mongoose');
      const hashedPassword = await bcrypt.hash('password123', 10);
      const mockUserId = new mongoose.Types.ObjectId();
      const mockUser = {
        _id: mockUserId,
        name: 'Test User',
        email: 'test@example.com',
        password: hashedPassword,
        role: 'user',
        comparePassword: jest.fn().mockResolvedValue(true),
      };

      User.findOne.mockResolvedValue(mockUser);

      const result = await loginUser('test@example.com', 'password123');

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(mockUser.comparePassword).toHaveBeenCalledWith('password123');
      expect(result).toHaveProperty('_id');
      expect(result).toHaveProperty('token');
      expect(result.email).toBe('test@example.com');
      expect(result).not.toHaveProperty('password');
    });

    it('should throw AuthenticationError for non-existent user', async () => {
      User.findOne.mockResolvedValue(null);
      await expect(loginUser('nonexistent@example.com', 'password123')).rejects.toThrow(AuthenticationError);
      await expect(loginUser('nonexistent@example.com', 'password123')).rejects.toThrow('Invalid credentials');
    });

    it('should throw AuthenticationError for incorrect password', async () => {
      const mongoose = require('mongoose');
      const hashedPassword = await bcrypt.hash('password123', 10);
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        email: 'test@example.com',
        password: hashedPassword,
        comparePassword: jest.fn().mockResolvedValue(false),
      };
      User.findOne.mockResolvedValue(mockUser);
      
      await expect(loginUser('test@example.com', 'wrongpassword')).rejects.toThrow(AuthenticationError);
      await expect(loginUser('test@example.com', 'wrongpassword')).rejects.toThrow('Invalid credentials');
    });

    it('should throw ValidationError when email is missing', async () => {
      const { ValidationError } = require('../../src/utils/errors');
      User.findOne.mockResolvedValue(null);
      await expect(loginUser('', 'password123')).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when password is missing', async () => {
      const { ValidationError } = require('../../src/utils/errors');
      const mockUser = {
        _id: '507f1f77bcf86cd799439017',
        email: 'test@example.com',
        comparePassword: jest.fn().mockResolvedValue(false),
      };
      
      User.findOne.mockResolvedValue(mockUser);
      await expect(loginUser('test@example.com', '')).rejects.toThrow(ValidationError);
    });
  });
});
