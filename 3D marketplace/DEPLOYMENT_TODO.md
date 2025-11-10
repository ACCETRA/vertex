# Deployment to Railway - Step-by-Step Plan

## Prerequisites
- [x] GitHub repository: https://github.com/ACCETRA/vertex/tree/master
- [x] Railway account created
- [x] Code is deploy-ready with Dockerfile

## Step 1: Connect GitHub Repo to Railway
- [ ] Log in to Railway dashboard at https://railway.app
- [ ] Click "New Project" > "Deploy from GitHub repo"
- [ ] Search for and select "ACCETRA/vertex" repository
- [ ] Select the "master" branch
- [ ] Railway will detect the Dockerfile automatically

## Step 2: Configure Environment Variables
- [ ] In Railway project settings, go to "Variables"
- [ ] Add the following variables:
  - NODE_ENV=production
  - PORT=3000
  - JWT_SECRET=<generate-a-secure-random-string>
  - DB_PATH=/app/data/marketplace.db
  - UPLOAD_PATH=/app/uploads
  - CORS_ORIGIN=<your-railway-app-url>
  - MAX_FILE_SIZE=10485760
  - ALLOWED_FILE_TYPES=.glb,.gltf,.obj,.fbx,.png,.jpg,.jpeg,.gif
  - RATE_LIMIT_WINDOW=15
  - RATE_LIMIT_MAX_REQUESTS=100
  - LOG_LEVEL=info

## Step 3: Add Persistent Volume for Database
- [ ] In Railway project, go to "Volumes"
- [ ] Create a new volume named "data" with mount path "/app/data"
- [ ] This ensures SQLite database persists across deployments

## Step 4: Configure Build and Start Commands
- [ ] In Railway service settings, set:
  - Build Command: `npm ci --only=production`
  - Start Command: `sh -c "npm run init-db && npm run migrate && npm start"`

## Step 5: Deploy the Application
- [ ] Click "Deploy" in Railway
- [ ] Monitor the build logs for any errors
- [ ] Once deployed, note the generated URL (e.g., https://your-app-name.up.railway.app)

## Step 6: Verify Deployment
- [ ] Visit the Railway URL
- [ ] Check /health endpoint for status
- [ ] Test user registration and login
- [ ] Upload a 3D model
- [ ] Test real-time messaging
- [ ] Verify database persistence (data survives redeploys)

## Step 7: Post-Deployment Tasks
- [ ] Update CORS_ORIGIN with the actual Railway URL
- [ ] Test file uploads and ensure they work
- [ ] Monitor logs in Railway dashboard
- [ ] Set up domain (optional) via Railway settings

## Troubleshooting
- If build fails, check Railway logs for errors
- Ensure all environment variables are set correctly
- For database issues, verify volume is mounted correctly
- If init-db fails, check DB_PATH and permissions
