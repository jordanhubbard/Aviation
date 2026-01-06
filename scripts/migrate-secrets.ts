#!/usr/bin/env ts-node
/**
 * Secret Migration Tool
 * 
 * This script migrates secrets from .env files into the secure keystore.
 * It can process multiple applications and organize secrets by service name.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SecureKeyStore } from '../packages/keystore/src';

interface MigrationConfig {
  appName: string;
  envFilePath: string;
  serviceName: string;
}

/**
 * Parse a .env file and return key-value pairs
 */
function parseEnvFile(filePath: string): Map<string, string> {
  const content = fs.readFileSync(filePath, 'utf8');
  const secrets = new Map<string, string>();
  
  const lines = content.split('\n');
  for (const line of lines) {
    // Skip comments and empty lines
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    
    // Parse KEY=VALUE format
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      secrets.set(key, value);
    }
  }
  
  return secrets;
}

/**
 * Determine if a key contains sensitive information
 */
function isSensitiveKey(key: string): boolean {
  const sensitivePatterns = [
    /KEY/i,
    /SECRET/i,
    /PASSWORD/i,
    /TOKEN/i,
    /API/i,
    /DSN/i,
    /SMTP.*PASSWORD/i,
    /DATABASE.*URL/i,
    /REDIS.*URL/i,
  ];
  
  return sensitivePatterns.some(pattern => pattern.test(key));
}

/**
 * Migrate secrets from an .env file to the keystore
 */
function migrateEnvFile(
  keystore: SecureKeyStore,
  config: MigrationConfig
): number {
  console.log(`\n📦 Migrating ${config.appName}...`);
  console.log(`   Source: ${config.envFilePath}`);
  console.log(`   Service: ${config.serviceName}`);
  
  if (!fs.existsSync(config.envFilePath)) {
    console.log(`   ⚠️  File not found, skipping`);
    return 0;
  }
  
  const secrets = parseEnvFile(config.envFilePath);
  let migratedCount = 0;
  let skippedCount = 0;
  
  for (const [key, value] of secrets.entries()) {
    if (isSensitiveKey(key)) {
      // Only migrate sensitive values
      keystore.setSecret(config.serviceName, key, value);
      console.log(`   ✓ Migrated: ${key}`);
      migratedCount++;
    } else {
      console.log(`   - Skipped (not sensitive): ${key}`);
      skippedCount++;
    }
  }
  
  console.log(`   📊 Summary: ${migratedCount} migrated, ${skippedCount} skipped`);
  return migratedCount;
}

/**
 * Main migration function
 */
async function main() {
  console.log('🔐 Aviation Monorepo Secret Migration Tool\n');
  console.log('═══════════════════════════════════════════\n');
  
  // Get the workspace root
  const workspaceRoot = path.resolve(__dirname, '..');
  
  // Define applications to migrate
  const migrations: MigrationConfig[] = [
    {
      appName: 'Aviation Missions',
      envFilePath: path.join(workspaceRoot, 'apps/aviation-missions-app/.env'),
      serviceName: 'aviation-missions',
    },
    {
      appName: 'ForeFlight Dashboard',
      envFilePath: path.join(workspaceRoot, 'apps/foreflight-dashboard/.env'),
      serviceName: 'foreflight-dashboard',
    },
    {
      appName: 'ForeFlight Dashboard (Production)',
      envFilePath: path.join(workspaceRoot, 'apps/foreflight-dashboard/.env.production'),
      serviceName: 'foreflight-dashboard',
    },
    {
      appName: 'Flight Planner',
      envFilePath: path.join(workspaceRoot, 'apps/flightplanner/.env'),
      serviceName: 'flightplanner',
    },
    {
      appName: 'Flight School',
      envFilePath: path.join(workspaceRoot, 'apps/flightschool/.env'),
      serviceName: 'flightschool',
    },
    {
      appName: 'Flight Tracker',
      envFilePath: path.join(workspaceRoot, 'apps/flight-tracker/.env'),
      serviceName: 'flight-tracker',
    },
    {
      appName: 'Weather Briefing',
      envFilePath: path.join(workspaceRoot, 'apps/weather-briefing/.env'),
      serviceName: 'weather-briefing',
    },
  ];
  
  // Initialize keystore
  const keystorePath = path.join(workspaceRoot, '.keystore');
  console.log(`📁 Keystore location: ${keystorePath}\n`);
  
  const keystore = new SecureKeyStore({
    storePath: keystorePath,
  });
  
  // Run migrations
  let totalMigrated = 0;
  for (const config of migrations) {
    totalMigrated += migrateEnvFile(keystore, config);
  }
  
  console.log('\n═══════════════════════════════════════════');
  console.log(`\n✅ Migration complete! Total secrets migrated: ${totalMigrated}\n`);
  
  if (totalMigrated > 0) {
    console.log('📝 Next steps:');
    console.log('   1. Verify secrets with: npm run keystore:list');
    console.log('   2. Update your applications to use the keystore');
    console.log('   3. Remove .env files after confirming migration');
    console.log('   4. Add .keystore to .gitignore (if not already there)\n');
  } else {
    console.log('ℹ️  No secrets found to migrate. This could mean:');
    console.log('   - .env files don\'t exist yet');
    console.log('   - .env files only contain non-sensitive configuration');
    console.log('   - Secrets have already been migrated\n');
  }
}

// Run the migration
main().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});

