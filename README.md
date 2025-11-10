# 3D Marketplace

A full-stack 3D marketplace application built with Node.js, Express, SQLite, and Three.js. Features real-time messaging, file uploads, user authentication, and a modern web interface.

## Features

- 🔐 User authentication with JWT
- 📦 3D model upload and management
- 💬 Real-time messaging between users
- ❤️ Like and comment system
- 🔍 Advanced search and filtering
- 📱 Responsive design
- 🐳 Docker support
- 📊 Production-ready with security features

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd 3d-marketplace
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Initialize the database:
```bash
npm run init-db
npm run migrate
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Environment Configuration

Create a `.env` file in the root directory:

```env
# Environment
NODE_ENV=development
PORT=3000

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Database Configuration
DB_PATH=./marketplace.db

# File Upload Configuration
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=.glb,.gltf,.obj,.fbx,.png,.jpg,.jpeg,.gif

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile/:userId` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Products
- `GET /api/products` - Get all products (with pagination/filtering)
- `GET /api/products/:id` - Get single product
- `POST /api/products/upload` - Upload new product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `GET /api/products/seller/:sellerId` - Get products by seller

### Messages
- `GET /api/messages` - Get user messages
- `GET /api/messages/conversations` - Get user conversations
- `POST /api/messages` - Send message
- `PUT /api/messages/read/:conversationId` - Mark messages as read

### Comments
- `GET /api/comments/:portfolioId` - Get comments for product
- `POST /api/comments/:portfolioId` - Add comment
- `PUT /api/comments/:commentId` - Update comment
- `DELETE /api/comments/:commentId` - Delete comment

### Likes
- `GET /api/likes/:portfolioId/count` - Get likes count
- `GET /api/likes/:portfolioId/user/:userId` - Check if user liked
- `POST /api/likes/:portfolioId` - Like product
- `DELETE /api/likes/:portfolioId` - Unlike product

## Docker Deployment

### Using Docker Compose

1. Build and run with Docker Compose:
```bash
docker-compose up -d
```

2. Initialize database (first time only):
```bash
docker-compose --profile init run db-init
```

### Manual Docker Build

```bash
docker build -t 3d-marketplace .
docker run -p 3000:3000 -v $(pwd)/data:/app/data -v $(pwd)/uploads:/app/uploads 3d-marketplace
```

## PM2 Deployment

For production deployment with PM2:

```bash
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## Security Features

- JWT authentication with expiration
- Input validation and sanitization
- Rate limiting
- CORS protection
- Security headers (Helmet)
- File upload validation
- SQL injection prevention
- XSS protection

## Development

### Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run init-db` - Initialize database
- `npm run migrate` - Run database migrations
- `npm test` - Run tests (placeholder)
- `npm run build` - Build for production (no-op for this project)

### Project Structure

```
├── middleware/           # Express middleware
│   ├── validation.js    # Input validation rules
│   ├── security.js      # Security middleware
│   └── errorHandler.js  # Error handling and logging
├── routes/              # API route handlers
│   ├── auth.js
│   ├── products.js
│   ├── messages.js
│   ├── comments.js
│   └── likes.js
├── scripts/             # Database scripts
│   ├── init-db.js
│   └── migrate.js
├── public/              # Static files
├── uploads/             # Uploaded files
├── logs/                # Application logs
├── db.js                # Database connection
├── server.js            # Main server file
└── package.json
```

## Health Checks

The application includes health check endpoints:

- `GET /health` - Application health status
- Returns JSON with status, database connection, uptime, and version

## Logging

Application logs are stored in the `logs/` directory:

- `error.log` - Error messages only
- `combined.log` - All log levels
- Console output in development mode

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
