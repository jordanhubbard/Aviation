---
id: Aviation-1qg.4
status: closed
deps: []
links: []
created: 2026-01-15T00:15:46.866614-08:00
type: task
priority: 1
parent: Aviation-1qg
mac-task-id: task_57ee5bd5421d4449a0e78cb73e163db4
---
# Implement containerized testing for all apps

Create docker-compose.test.yml and make test-docker targets for all 7 apps.

Goal: Root 'make test' should spin up each app in containers, run tests, shut down.

Per-app tasks:
- [ ] Create docker-compose.test.yml
- [ ] Add 'make test-docker' target to Makefile
- [ ] Configure test command in docker-compose
- [ ] Set up test database/dependencies in containers
- [ ] Verify tests pass in containers
- [ ] Add test results reporting

Root Makefile update:
- [ ] Update 'make test' to run containerized tests
- [ ] Add 'make test-local' for non-containerized tests
- [ ] Add parallel test execution (optional)
- [ ] Add test result aggregation

Pattern to implement:
```yaml
# docker-compose.test.yml
version: '3.8'
services:
  backend-test:
    build: ./backend
    command: npm test
    environment:
      - NODE_ENV=test
```

```makefile
test-docker:
	docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
	docker-compose -f docker-compose.test.yml down -v
```

Apps to implement:
1. aviation-accident-tracker
2. aviation-missions-app
3. flight-tracker
4. flightplanner
5. flightschool
6. foreflight-dashboard
7. weather-briefing
