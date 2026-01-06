#!/usr/bin/env ts-node
/**
 * Keystore CLI Tool
 * 
 * Command-line interface for managing secrets in the secure keystore.
 */

import * as path from 'path';
import { SecureKeyStore } from '../packages/keystore/src';

const commands = {
  list: 'List all services or keys in a service',
  get: 'Get a secret value',
  set: 'Set a secret value',
  delete: 'Delete a secret',
  services: 'List all services with secrets',
};

function showUsage() {
  console.log('🔐 Keystore CLI\n');
  console.log('Usage: npm run keystore <command> [options]\n');
  console.log('Commands:');
  Object.entries(commands).forEach(([cmd, desc]) => {
    console.log(`  ${cmd.padEnd(12)} ${desc}`);
  });
  console.log('\nExamples:');
  console.log('  npm run keystore services');
  console.log('  npm run keystore list foreflight-dashboard');
  console.log('  npm run keystore get foreflight-dashboard SECRET_KEY');
  console.log('  npm run keystore set foreflight-dashboard API_KEY "your-key-here"');
  console.log('  npm run keystore delete foreflight-dashboard OLD_KEY');
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    showUsage();
    return;
  }
  
  const command = args[0];
  const workspaceRoot = path.resolve(__dirname, '..');
  const keystorePath = path.join(workspaceRoot, '.keystore');
  
  const keystore = new SecureKeyStore({
    storePath: keystorePath,
  });
  
  switch (command) {
    case 'services': {
      console.log('📋 Services with secrets:\n');
      const services = new Set<string>();
      
      // This is a bit of a hack since we don't have a listServices method
      // We'll need to read the internal secrets map
      const allKeys = (keystore as any).secrets.keys();
      for (const key of allKeys) {
        const service = key.split(':')[0];
        services.add(service);
      }
      
      if (services.size === 0) {
        console.log('   No services found. Run migration first.');
      } else {
        Array.from(services).sort().forEach(service => {
          const keys = keystore.listKeys(service);
          console.log(`   • ${service} (${keys.length} secrets)`);
        });
      }
      break;
    }
    
    case 'list': {
      if (args.length < 2) {
        console.error('❌ Error: Service name required');
        console.log('Usage: npm run keystore list <service>');
        process.exit(1);
      }
      
      const service = args[1];
      const keys = keystore.listKeys(service);
      
      console.log(`\n🔑 Secrets for service: ${service}\n`);
      if (keys.length === 0) {
        console.log('   No secrets found for this service.');
      } else {
        keys.sort().forEach(key => {
          console.log(`   • ${key}`);
        });
      }
      break;
    }
    
    case 'get': {
      if (args.length < 3) {
        console.error('❌ Error: Service and key required');
        console.log('Usage: npm run keystore get <service> <key>');
        process.exit(1);
      }
      
      const service = args[1];
      const key = args[2];
      const value = keystore.getSecret(service, key);
      
      if (value === undefined) {
        console.log(`❌ Secret not found: ${service}:${key}`);
        process.exit(1);
      } else {
        console.log(`\n🔐 ${service}:${key}`);
        console.log(`   ${value}\n`);
      }
      break;
    }
    
    case 'set': {
      if (args.length < 4) {
        console.error('❌ Error: Service, key, and value required');
        console.log('Usage: npm run keystore set <service> <key> <value>');
        process.exit(1);
      }
      
      const service = args[1];
      const key = args[2];
      const value = args[3];
      
      keystore.setSecret(service, key, value);
      console.log(`✅ Secret set: ${service}:${key}`);
      break;
    }
    
    case 'delete': {
      if (args.length < 3) {
        console.error('❌ Error: Service and key required');
        console.log('Usage: npm run keystore delete <service> <key>');
        process.exit(1);
      }
      
      const service = args[1];
      const key = args[2];
      const deleted = keystore.deleteSecret(service, key);
      
      if (deleted) {
        console.log(`✅ Secret deleted: ${service}:${key}`);
      } else {
        console.log(`❌ Secret not found: ${service}:${key}`);
        process.exit(1);
      }
      break;
    }
    
    default:
      console.error(`❌ Unknown command: ${command}`);
      showUsage();
      process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

