const { registerUser, loginUser } = require('../services/userService');
const { registerSchema, loginSchema } = require('../validators/userValidator');
const { asyncHandler } = require('../middleware/errorMiddleware');

const register = asyncHandler(async (req, res) => {
  const validatedData = registerSchema.parse(req.body);
  const user = await registerUser(validatedData);
  res.status(201).json({
    success: true,
    data: user,
  });
});

const login = asyncHandler(async (req, res) => {
  const validatedData = loginSchema.parse(req.body);
  const user = await loginUser(validatedData.email, validatedData.password);
  res.status(200).json({
    success: true,
    data: user,
  });
});

module.exports = { register, login };
