import * as fs from 'fs';
import * as path from 'path';
import { load as loadYaml } from 'js-yaml';
import * as dotenv from 'dotenv';
import { KeystoreClient } from '../keystore/client';

interface Config {
  [key: string]: any;
}

export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: Config = {};

  private constructor() {
    this.loadConfig();
  }

  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  private loadConfig() {
    // Load from file
    const configFile = path.join(__dirname, '../../config.yaml');
    if (fs.existsSync(configFile)) {
      const fileConfig = loadYaml(fs.readFileSync(configFile, 'utf8')) as Config;
      this.mergeConfig(fileConfig);
    }

    // Load from environment variables
    dotenv.config();
    const envConfig = Object.keys(process.env).reduce((acc, key) => {
      acc[key] = process.env[key];
      return acc;
    }, {} as Config);
    this.mergeConfig(envConfig);

    // Load from keystore
    const keystore = new KeystoreClient();
    const keystoreConfig = keystore.getAll();
    this.mergeConfig(keystoreConfig);
  }

  private mergeConfig(newConfig: Config) {
    this.config = { ...this.config, ...newConfig };
  }

  public get(key: string): any {
    return this.config[key];
  }

  public set(key: string, value: any) {
    this.config[key] = value;
  }
}
