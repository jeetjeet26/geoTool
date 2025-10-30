# Heroku Deployment Instructions

## Prerequisites
1. Ensure you're logged into Heroku CLI: `heroku login`
2. Make sure all your changes are committed to git

## Quick Deployment Steps

1. **Create the Heroku app:**
   ```bash
   heroku create geotool-app
   ```

2. **Set up buildpacks (pnpm support):**
   ```bash
   heroku buildpacks:add heroku/nodejs -a geotool-app
   ```

3. **Add PostgreSQL database:**
   ```bash
   heroku addons:create heroku-postgresql:mini -a geotool-app
   ```

4. **Set environment variables:**
   ```bash
   heroku config:set OPENAI_API_KEY=your_openai_key -a geotool-app
   heroku config:set ANTHROPIC_API_KEY=your_anthropic_key -a geotool-app
   heroku config:set RUN_DEFAULT_BATCH=40 -a geotool-app
   heroku config:set RUN_SEED=42 -a geotool-app
   heroku config:set TEMPERATURE=0 -a geotool-app
   heroku config:set TOP_P=1 -a geotool-app
   heroku config:set OPENAI_MODEL=gpt-4o-mini -a geotool-app
   heroku config:set ANTHROPIC_MODEL=claude-3-haiku-20240307 -a geotool-app
   ```
   
   Note: DATABASE_URL will be automatically set by the PostgreSQL addon.

5. **Run database migrations:**
   ```bash
   heroku run "pnpm --filter @geo/db prisma migrate deploy" -a geotool-app
   ```

6. **Push to Heroku:**
   ```bash
   git push heroku main
   ```

## Alternative: Use the deployment script

If you're on Unix/Mac, you can use the provided script:
```bash
chmod +x deploy-heroku.sh
./deploy-heroku.sh
```

## Post-Deployment

After deployment, you may want to:
- Run seed data: `heroku run "pnpm seed" -a geotool-app`
- Check logs: `heroku logs --tail -a geotool-app`
- Open your app: `heroku open -a geotool-app`

## Troubleshooting

- If build fails, check logs: `heroku logs --tail -a geotool-app`
- If you need to restart: `heroku restart -a geotool-app`
- To check config vars: `heroku config -a geotool-app`

