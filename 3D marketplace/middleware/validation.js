const { body, param, validationResult } = require('express-validator');

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// User validation rules
const validateSignup = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),

  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),

  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),

  body('accountType')
    .isIn(['client', 'seller'])
    .withMessage('Account type must be either client or seller'),

  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),

  handleValidationErrors
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  handleValidationErrors
];

const validateProfileUpdate = [
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),

  body('profilePic')
    .optional()
    .isURL()
    .withMessage('Profile picture must be a valid URL'),

  handleValidationErrors
];

// Product validation rules
const validateProductUpload = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title is required and must be less than 100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),

  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),

  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required'),

  body('dimension')
    .optional()
    .isIn(['2D', '3D'])
    .withMessage('Dimension must be either 2D or 3D'),

  body('tags')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Tags cannot exceed 200 characters'),

  handleValidationErrors
];

// Message validation rules
const validateMessage = [
  body('receiverId')
    .isInt({ min: 1 })
    .withMessage('Valid receiver ID is required'),

  body('productId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Product ID must be a valid integer'),

  body('text')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message text is required and must be less than 1000 characters'),

  handleValidationErrors
];

// Comment validation rules
const validateComment = [
  body('text')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Comment text is required and must be less than 500 characters'),

  handleValidationErrors
];

// Parameter validation
const validateIdParam = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a valid integer'),

  handleValidationErrors
];

const validatePortfolioIdParam = [
  param('portfolioId')
    .isInt({ min: 1 })
    .withMessage('Portfolio ID must be a valid integer'),

  handleValidationErrors
];

const validateUserIdParam = [
  param('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a valid integer'),

  handleValidationErrors
];

const validateCommentIdParam = [
  param('commentId')
    .isInt({ min: 1 })
    .withMessage('Comment ID must be a valid integer'),

  handleValidationErrors
];

module.exports = {
  validateSignup,
  validateLogin,
  validateProfileUpdate,
  validateProductUpload,
  validateMessage,
  validateComment,
  validateIdParam,
  validatePortfolioIdParam,
  validateUserIdParam,
  validateCommentIdParam,
  handleValidationErrors
};
