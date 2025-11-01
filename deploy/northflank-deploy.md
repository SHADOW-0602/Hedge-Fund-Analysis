# Northflank Deployment Guide

## 1. Prerequisites
- Northflank account
- GitHub repository with your code
- Environment variables ready

## 2. Create Service
1. Go to Northflank dashboard
2. Click "Create Service"
3. Select "Build from Git"
4. Connect your GitHub repository

## 3. Configure Build
- **Build Context**: `/`
- **Dockerfile**: `Dockerfile`
- **Port**: `8080`

## 4. Environment Variables
Add these in Northflank dashboard:

### Required API Keys
```
FINNHUB_API_KEY=your_key
POLYGON_API_KEY=your_key
ALPHA_VANTAGE_API_KEY=your_key
TWELVE_DATA_API_KEY=your_key
FRED_API_KEY=your_key
```

### Database (Optional)
```
SUPABASE_URL=your_url
SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_KEY=your_key
```

### Security
```
JWT_SECRET_KEY=your_secret
FLASK_SECRET_KEY=your_secret
FLASK_ENV=production
```

## 5. Resource Configuration
- **CPU**: 0.5 vCPU
- **Memory**: 1GB
- **Scaling**: 1-3 instances

## 6. Health Check
- **Path**: `/health`
- **Interval**: 30s
- **Timeout**: 10s

## 7. Deploy
1. Click "Deploy"
2. Monitor build logs
3. Access via provided URL

## Files Created
- `Dockerfile` - Container configuration
- `northflank.json` - Service configuration
- `.dockerignore` - Build optimization
- Health check endpoint in `app.py`