# Custom Domain Setup for Cloudflare Pages

## Method 1: Cloudflare Dashboard (Recommended)

1. **Go to Cloudflare Dashboard** > Pages > Your Project
2. **Custom domains** tab > **Set up a custom domain**
3. **Enter your domain**: `shmventures.org`
4. **Add domain** - Cloudflare will provide DNS records
5. **Update DNS** in your domain registrar:
   - Add CNAME record: `shmventures.org` → `your-project.pages.dev`
   - Add CNAME record: `www.shmventures.org` → `your-project.pages.dev`

## Method 2: Update wrangler.toml

Replace the route comments in `wrangler.toml`:
```toml
route = { pattern = "shmventures.org", custom_domain = true }
route = { pattern = "www.shmventures.org", custom_domain = true }
```

## DNS Configuration

In your domain registrar's DNS settings:
```
Type: CNAME
Name: @
Value: your-project.pages.dev

Type: CNAME  
Name: www
Value: your-project.pages.dev
```

## SSL Certificate
- Automatically provisioned by Cloudflare
- Usually active within 24 hours
- Supports both HTTP and HTTPS

## Verification
- Check domain status in Cloudflare Dashboard
- Test both `shmventures.org` and `www.shmventures.org`