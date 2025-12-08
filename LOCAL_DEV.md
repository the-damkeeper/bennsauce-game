# Local Development Setup

## Running Locally (Recommended for Development)

1. **Start the game server:**
   - Open a terminal and run: .\start-servers.bat
   - Server will run at http://localhost:3000

2. **Start the client:**
   - Open another terminal and run: .\start-local.bat
   - Client will be available at http://localhost:8080
   - Open http://localhost:8080 in your browser

3. **Make changes:**
   - Edit any file and save
   - Refresh your browser (F5) to see changes
   - No deploy needed!

## Deploying to Production

Only deploy when you're ready to publish changes:

1. **Commit your changes:**
   ```
   git add -A
   git commit -m "Your message"
   ```

2. **Push to deploy:**
   ```
   git push
   ```

**WARNING:** Each push uses Netlify build credits (300/month free).
Test locally first to avoid running out of credits!

## Netlify Build Credits

- Free tier: 300 minutes/month
- Each deploy uses ~15 credits
- ~20 deploys per month maximum
- Resets on the 1st of each month

