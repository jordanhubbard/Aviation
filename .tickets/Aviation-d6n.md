---
id: Aviation-d6n
status: closed
deps: []
links: []
created: 2026-01-14T08:54:53.885477-08:00
type: task
priority: 2
mac-task-id: task_25654cc822394017ad4dcbf6358ae0a9
---
# Deploy accident-tracker to production

Deploy the Aviation Accident Tracker application to production:

**Prerequisites:**
- ✅ OpenAPI documentation complete
- ✅ Scheduled ingestion implemented
- ✅ Frontend tests complete (30+ tests)
- ✅ Backend validated

**Deployment Options:**
1. Railway (recommended for quick deploy)
2. Fly.io
3. AWS ECS/Fargate
4. DigitalOcean App Platform

**Deployment Steps:**
1. Create production environment variables
2. Set up database (SQLite → PostgreSQL for production)
3. Configure ingestion secrets (ASN, AVHerald)
4. Deploy backend + frontend
5. Set up scheduled ingestion (cron)
6. Configure monitoring/alerting
7. Set up CI/CD pipeline for auto-deploy

**Production Checklist:**
- [ ] Environment variables configured
- [ ] Database migrated to PostgreSQL
- [ ] SSL/HTTPS enabled
- [ ] Rate limiting configured
- [ ] Monitoring enabled
- [ ] Health checks working
- [ ] Scheduled ingestion running
- [ ] Documentation updated with production URL

**Priority:** P2
