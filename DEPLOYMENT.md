# Deployment Guide - Render.com (Actually Free!)

## Why Render?

✅ **Truly free tier** (not a trial)
- 750 hours/month free compute
- Automatic HTTPS
- Auto-deploy from GitHub
- Zero credit card required for free tier
- Spins down after 15 min inactivity (cold starts ~30s)

## Quick Deploy (5 Minutes)

### 1. Go to Render Dashboard
https://dashboard.render.com/

### 2. Connect GitHub
- Click "New +" → "Web Service"
- Connect your GitHub account
- Select `aaronvstory/image-rotator` repository
- Choose branch: `main` (after merging PR #1)

### 3. Configure Service
Render will auto-detect the `render.yaml` config, or manually set:

- **Name**: `image-rotator`
- **Runtime**: Node
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: Free

### 4. Add Environment Variables
Click "Environment" and add:
- `OPENROUTER_API_KEY` = your API key
- `OCR_CONCURRENCY` = 2
- `NODE_VERSION` = 18.0.0

### 5. Deploy!
Click "Create Web Service" - Render will build and deploy automatically!

## Auto-Deploy Setup

Once deployed:
1. Every push to `main` triggers auto-deployment
2. View logs in Render dashboard
3. Get your live URL: `https://image-rotator.onrender.com`

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENROUTER_API_KEY` | OpenRouter API key for OCR | ✅ Yes |
| `OCR_CONCURRENCY` | Parallel OCR workers (1-5) | No (default: 1) |
| `NODE_VERSION` | Node.js version | No (default: 18) |
| `PORT` | Server port | No (Render auto-assigns) |

## Free Tier Limits

- **Compute**: 750 hours/month
- **Memory**: 512 MB
- **Bandwidth**: 100 GB/month
- **Cold Starts**: Service sleeps after 15 min inactivity
  - First request after sleep takes ~30 seconds
  - Subsequent requests are instant
  - Great for development/demo sites!

## Keep Service Awake (Optional)

Use a free uptime monitor:
- **UptimeRobot** (https://uptimerobot.com/)
- Ping your site every 14 minutes
- Prevents cold starts

## Alternative: Docker Deployment

If you prefer other platforms (DigitalOcean, AWS, etc.), use Docker:

```bash
# Build
docker build -t image-rotator .

# Run
docker run -p 3000:3000 \
  -e OPENROUTER_API_KEY=your-key \
  -e OCR_CONCURRENCY=2 \
  image-rotator
```

Need a Dockerfile? Let me know!

## Troubleshooting

### Sharp Build Issues
Render automatically handles Sharp's native dependencies. If issues occur:
- Check build logs in Render dashboard
- Ensure `NODE_VERSION` is set to 18 or higher

### OCR Not Working
Verify environment variables:
- Go to Render dashboard → Your service → Environment
- Check `OPENROUTER_API_KEY` is set correctly

### Service Won't Start
Check logs in Render dashboard:
- Build logs show installation issues
- Deploy logs show runtime errors

## Cost Comparison

| Platform | Free Tier | Notes |
|----------|-----------|-------|
| **Render** | ✅ 750 hrs/month | No credit card, cold starts |
| Railway | ❌ Databases only | Changed to paid-only for apps |
| Heroku | ❌ Discontinued | No longer offers free tier |
| Vercel | ⚠️ Static only | Can't run Node.js backend |
| Netlify | ⚠️ Functions only | Limited for full Express apps |

**Render is the best free option for Node.js backends!**
