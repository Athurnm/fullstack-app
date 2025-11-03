# Fullstack Application - Table Extraction with AI

A modern fullstack application that extracts tables from documents using OpenRouter AI models. Features a React frontend and Node.js backend with Docker containerization for easy deployment.

## 🚀 Features

- **File Upload**: Support for PDF, images, and documents
- **AI-Powered Table Extraction**: Uses OpenRouter API with multiple AI models
- **Real-time Processing**: Live progress updates during file processing
- **Responsive UI**: Modern React interface with error boundaries
- **Docker Ready**: Complete containerization setup
- **Production Ready**: Nginx reverse proxy, SSL support, and security headers

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │    │   Nginx Proxy   │    │   Node.js API   │
│   (Port 3000)   │◄──►│   (Port 80/443) │◄──►│   (Port 5000)   │
│                 │    │                 │    │                 │
│ - File Upload   │    │ - SSL/TLS       │    │ - OpenRouter API│
│ - Progress UI   │    │ - Rate Limiting │    │ - File Processing│
│ - Table Display │    │ - Caching       │    │ - Multer Upload │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              ▲
                              │
                       ┌─────────────────┐
                       │   Redis Cache   │
                       │   (Port 6379)   │
                       └─────────────────┘
```

## 📋 Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- OpenRouter API key

## 🚀 Quick Start

### Development

1. **Clone and setup:**
   ```bash
   git clone <repository-url>
   cd fullstack-app
   cp .env.example backend/.env
   ```

2. **Configure environment:**
   Edit `backend/.env` and set your OpenRouter API key:
   ```env
   OPENROUTER_API_KEY=your_api_key_here
   ```

3. **Start development servers:**
   ```bash
   # Backend
   cd backend && npm install && npm run dev

   # Frontend (new terminal)
   cd frontend && npm install && npm start
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

### Production Deployment

1. **Configure production environment:**
   ```bash
   cp .env.example backend/.env.production
   # Edit backend/.env.production with production values
   ```

2. **Deploy with Docker Compose:**
   ```bash
   # Development deployment
   ./deploy.sh

   # Production deployment
   docker-compose -f docker-compose.prod.yml --profile ssl up -d
   ```

3. **Access production application:**
   - HTTP: http://your-server-ip
   - HTTPS: https://yourdomain.com (after SSL setup)

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Backend server port | `5000` |
| `OPENROUTER_API_KEY` | OpenRouter API key | Required |
| `UPLOAD_DIR` | File upload directory | `uploads/` |
| `MAX_FILE_SIZE` | Maximum file size (bytes) | `10485760` |

### SSL Setup

For HTTPS in production:

1. Place SSL certificates in `nginx/ssl/`:
   - `fullchain.pem` - Certificate chain
   - `privkey.pem` - Private key

2. Update `nginx/nginx.conf` with your domain name

3. Deploy with SSL profile:
   ```bash
   docker-compose -f docker-compose.prod.yml --profile ssl up -d
   ```

## 📁 Project Structure

```
fullstack-app/
├── backend/                 # Node.js API server
│   ├── Dockerfile          # Backend container config
│   ├── package.json        # Backend dependencies
│   ├── server.js           # Main server file
│   ├── services/           # Business logic
│   └── uploads/            # File upload directory
├── frontend/               # React application
│   ├── Dockerfile          # Frontend container config
│   ├── package.json        # Frontend dependencies
│   ├── public/             # Static assets
│   ├── src/                # React source code
│   └── nginx.conf          # Nginx config for frontend
├── nginx/                  # Production proxy config
│   ├── nginx.conf          # Main nginx configuration
│   └── ssl/                # SSL certificates directory
├── docker-compose.yml      # Development orchestration
├── docker-compose.prod.yml # Production orchestration
├── deploy.sh              # Deployment script
└── .env.example           # Environment template
```

## 🐳 Docker Commands

### Development
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up -d --build
```

### Production
```bash
# Deploy production stack
docker-compose -f docker-compose.prod.yml up -d

# Deploy with SSL
docker-compose -f docker-compose.prod.yml --profile ssl up -d

# Scale services
docker-compose -f docker-compose.prod.yml up -d --scale backend=3
```

## 🔒 Security Features

- **Helmet.js**: Security headers for Express
- **Rate Limiting**: API rate limiting with Nginx
- **CORS**: Configured cross-origin policies
- **Input Validation**: File type and size validation
- **HTTPS**: SSL/TLS encryption in production
- **Security Headers**: XSS protection, content type sniffing prevention

## 📊 Monitoring & Health Checks

- **Health Endpoints**: `/health` for service status
- **Container Health Checks**: Built-in Docker health checks
- **Logging**: Morgan middleware for HTTP request logging
- **Metrics**: Basic health check integration

## 🚀 API Endpoints

### Backend API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Server info |
| GET | `/api/config` | Get API configuration |
| POST | `/api/config` | Update API configuration |
| GET | `/api/models` | List available AI models |
| POST | `/api/process-file` | Process single file |
| POST | `/api/process-uploaded-files` | Process multiple uploaded files |
| POST | `/upload` | Single file upload |
| POST | `/upload-multiple` | Multiple file upload |

### Frontend Routes

- `/` - Main application
- All routes handled by React Router

## 🧪 Testing

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# End-to-end tests (if implemented)
npm run test:e2e
```

## 📝 Development

### Adding New Features

1. **Backend**: Add routes in `server.js` or create new service files
2. **Frontend**: Add components in `src/components/`
3. **Database**: Add Redis caching or database integration as needed

### Code Quality

```bash
# Lint frontend code
cd frontend && npm run lint

# Fix linting issues
cd frontend && npm run lint:fix
```

## 🚀 Deployment Options

### Cloud Platforms

- **AWS**: Use ECS with Fargate or EC2
- **Google Cloud**: Cloud Run or GKE
- **Azure**: Container Instances or AKS
- **DigitalOcean**: App Platform or Droplets
- **Heroku**: Container registry deployment

### Manual Server Deployment

1. Provision Ubuntu/CentOS server
2. Install Docker and Docker Compose
3. Clone repository
4. Configure environment variables
5. Run deployment script

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Troubleshooting

### Common Issues

1. **Port conflicts**: Change ports in docker-compose.yml
2. **API key issues**: Verify OpenRouter API key format
3. **File upload fails**: Check file size limits and permissions
4. **SSL issues**: Verify certificate paths and permissions

### Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Health Checks

```bash
# Check container health
docker ps

# Test API endpoints
curl http://localhost/api/
curl http://localhost/health