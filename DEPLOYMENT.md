# Railway Deployment Guide

## Automated Setup Complete ✅

The project is now configured for Railway deployment with:
- `railway.json` - Build and deployment configuration
- `.railwayignore` - Files to exclude from deployment
- `package.json` - Node.js engine requirements (>=18.0.0)

## Manual Deployment Steps (One-Time Setup)

### Option 1: Deploy via Railway CLI (Recommended)

```bash
# 1. Login to Railway (opens browser)
railway login

# 2. Initialize project in current directory
railway init

# 3. Link to GitHub repository (optional but recommended)
railway link

# 4. Set required environment variables
railway variables set OPENROUTER_API_KEY="your-api-key-here"
railway variables set OCR_CONCURRENCY=2
railway variables set PORT=3000

# 5. Deploy!
railway up
```

### Option 2: Deploy via Railway Dashboard (No CLI needed)

1. **Go to**: https://railway.app/
2. **Sign up/Login** with GitHub
3. **Click**: "New Project" → "Deploy from GitHub repo"
4. **Select**: `aaronvstory/image-rotator`
5. **Choose branch**: `main` (after merging PR #1)
6. **Add Environment Variables**:
   - `OPENROUTER_API_KEY` = your OpenRouter API key
   - `OCR_CONCURRENCY` = 2
   - `PORT` = 3000
7. **Click**: "Deploy"

Railway will auto-detect Node.js and deploy automatically!

## Environment Variables Required

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENROUTER_API_KEY` | OpenRouter API key for OCR | ✅ Yes |
| `OCR_CONCURRENCY` | Parallel OCR workers (1-5) | No (default: 1) |
| `PORT` | Server port | No (Railway auto-assigns) |
| `IMAGE_DIR` | Default image directory | No |

## Post-Deployment

### Get Your Live URL
```bash
railway domain
```

### View Logs
```bash
railway logs
```

### Update Deployment
```bash
git push origin main  # Railway auto-deploys on push
```

## Free Tier Limits

- **Execution Time**: 500 hours/month
- **Memory**: 512 MB - 8 GB
- **Bandwidth**: Unlimited
- **Deployments**: Unlimited

Perfect for this image processing app!

## Troubleshooting

### Sharp Library Issues
Railway uses Nixpacks which handles Sharp's native dependencies automatically. If you see errors:
```bash
railway run npm rebuild sharp
```

### OCR Not Working
Check environment variables are set:
```bash
railway variables
```

### Memory Issues
Increase memory in Railway dashboard or reduce `OCR_CONCURRENCY`.

## Alternative: GitHub Integration (Auto-Deploy)

Once deployed via Dashboard:
1. Railway automatically connects to your GitHub repo
2. Every push to `main` triggers auto-deployment
3. View deployment status in Railway dashboard
4. Automatic rollback on deployment failure

## Cost Estimate

**Free Tier**: Covers most development and light production use
- 500 hours = ~20 days of 24/7 operation
- Perfect for testing and low-traffic production

**Pro Plan** ($5/month): If you exceed free tier
- $5 base + usage-based pricing
- Still very affordable for most use cases
