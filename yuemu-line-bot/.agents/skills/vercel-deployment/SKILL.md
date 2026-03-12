---
name: vercel-deployment
description: Agent skill for deploying web applications and serverless functions to Vercel.
---
# Vercel Deployment Skill

This skill provides guidelines for deploying applications (such as Next.js, React, or standard Node.js API routes) to Vercel.

## Best Practices

When asked to configure, troubleshoot, or deploy to Vercel, follow these guidelines:

1. **Framework Optimization**: Vercel offers zero-configuration deployments for many modern frameworks (Next.js, Vite, Nuxt). Rely on default build behaviors when possible, and only override build commands or output directories if strictly necessary.
2. **Environment Variables**:
   - Distinctly manage variables across `Development`, `Preview`, and `Production` environments.
   - Remind the user to sync local `.env` files with Vercel environment settings using the Vercel CLI (`vercel env pull`).
3. **Runtimes (Edge vs. Node.js)**:
   - **Edge Runtime**: Use for middleware, lightweight routing, and fast geo-localized responses. Note its limitations (e.g., no native Node.js APIs or heavy database clients).
   - **Node.js Serverless**: Use for standard API routes, heavy computations, or traditional database querying.
4. **Configuration (`vercel.json`)**: Use `vercel.json` for advanced configurations such as custom routing, rewrites, redirects, CORS headers, and crons, but avoid it if the framework natively handles these features (e.g., Next.js `next.config.js`).
5. **Caching & Performance**: Emphasize statically generating pages and using ISR (Incremental Static Regeneration). Utilize standard Cache-Control headers which Vercel's Edge Network automatically respects.
6. **Deployment Workflow**: Encourage deployment via Git integration for automatic CI/CD. When using CLI, use `vercel` for preview deployments and `vercel --prod` for production.
