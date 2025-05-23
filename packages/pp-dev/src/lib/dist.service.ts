import * as path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import * as crypto from 'crypto';
import * as process from 'process';
import * as child_process from 'child_process';
import * as console from 'console';
import { createLogger } from './logger.js';
import { Logger } from 'vite';
import { colors } from './helpers/color.helper.js';

export const TEMPLATE_PART_PAGE_NAME = 'pageName';
export const TEMPLATE_PART_DATE = 'date';

const DIRNAME = path.dirname((typeof __filename !== 'undefined' && __filename) || fileURLToPath(import.meta.url));

const pluginPath = path.resolve(DIRNAME, '..', '..');
const node_modules_path = path.resolve(pluginPath, '..', '..');

export interface SyncOptions {
  backupFolder?: string;
  backupNameTemplate?: string;
  dateFormat?: (date: Date) => string;
  distZipFolder?: string;
  distZipFilename?: string;
}

export interface SyncMeta {
  lastBackupName: string;
  lastBackupHash: string;
  lastBackupDate: string;
}

const metaDirName = '.pp-dev-meta';
const metaDirPath = path.resolve(node_modules_path, metaDirName);
const metaFilePath = path.resolve(metaDirPath, 'sync-service.meta.json');

export class DistService {
  private readonly backupFolder: string;
  private backupNameTemplate: string;
  private readonly dateFormat: (date: Date) => string;
  private readonly pageName: string;
  private currentMeta: SyncMeta | null = null;
  private readonly distZipFolder: string;
  private readonly distZipFilename: string;

  private logger: Logger;

  constructor(pageName: string, syncOptions?: SyncOptions) {
    this.pageName = pageName;

    const {
      backupFolder = path.resolve(process.cwd(), 'backups'),
      distZipFolder = path.resolve(process.cwd(), 'dist-zip'),
      distZipFilename = `${this.pageName}.zip`,
      backupNameTemplate = `{${TEMPLATE_PART_PAGE_NAME}}-{${TEMPLATE_PART_DATE}}.zip`,
      dateFormat = (date: Date) => date.toISOString().replace(/:/g, '-').replace(/\..*$/, ''),
    } = syncOptions || {};

    this.backupFolder = backupFolder;
    this.backupNameTemplate = backupNameTemplate;
    this.dateFormat = dateFormat;

    this.distZipFolder = distZipFolder;
    this.distZipFilename = distZipFilename;

    this.syncMeta();

    this.logger = createLogger();
  }

  async checkMeta() {
    try {
      await fs.stat(metaDirPath);
    } catch {
      await fs.mkdir(metaDirPath);
    }

    try {
      await fs.stat(this.backupFolder);
    } catch {
      await fs.mkdir(this.backupFolder);
    }
  }

  async readMetaFile() {
    await this.checkMeta();

    return await fs
      .readFile(metaFilePath, {
        encoding: 'utf-8',
      })
      .catch(() => '{}');
  }

  async writeMetaFile(meta: SyncMeta) {
    await this.checkMeta();

    return await fs.writeFile(metaFilePath, JSON.stringify(meta, null, 2), {
      encoding: 'utf-8',
    });
  }

  async syncMeta() {
    if (!this.currentMeta) {
      this.currentMeta = JSON.parse(await this.readMetaFile());
    } else {
      await this.writeMetaFile(this.currentMeta);
    }
  }

  async getLatestSavedBackup() {
    const { lastBackupName } = this.currentMeta!;

    if (!lastBackupName) {
      return null;
    }

    const backupPath = path.resolve(this.backupFolder, lastBackupName);

    try {
      await fs.stat(backupPath);

      return backupPath;
    } catch {
      return null;
    }
  }

  backupName(pageName: string, date: Date = new Date()) {
    return this.backupNameTemplate
      .replace(`{${TEMPLATE_PART_PAGE_NAME}}`, pageName)
      .replace(`{${TEMPLATE_PART_DATE}}`, this.dateFormat(date));
  }

  getBackupMeta() {
    return this.currentMeta;
  }

  async saveBackup(backupFile: Buffer) {
    // Verify if the backup file is an ZIP file (magic number)
    if (backupFile.toString('utf-8').slice(0, 4) !== 'PK\x03\x04') {
      throw new Error('Backup file is not a ZIP file');
    }

    const backupFileHash = crypto.createHash('md5').update(backupFile).digest('hex');
    const lastSavedBackup = await this.getLatestSavedBackup();

    if (lastSavedBackup) {
      const { lastBackupHash } = this.currentMeta!;

      if (lastBackupHash === backupFileHash) {
        return;
      }
    }

    const backupDate = new Date();

    const filename = this.backupName(this.pageName, backupDate);

    this.currentMeta!.lastBackupName = filename;
    this.currentMeta!.lastBackupHash = backupFileHash;
    this.currentMeta!.lastBackupDate = backupDate.toISOString();

    await this.syncMeta();

    return await fs.writeFile(path.resolve(this.backupFolder, filename), backupFile).finally(() => {
      this.logger.info(`Backup saved to ${filename}`);
    });
  }

  async buildNewAssets() {
    const buildCommand = new Promise<string>((resolve, reject) => {
      let data = '';

      // Colorized log output with message about build start
      this.logger.info(colors.cyan('[DistService] Build started'));

      const proc = child_process.spawn('node', [path.resolve(pluginPath, './bin/pp-dev.js'), 'build'], {
        cwd: process.cwd(),
        env: Object.assign({}, process.env, { NODE_ENV: 'production' }),
        stdio: 'inherit',
      });

      proc.on('message', (msg) => {
        data += msg;
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`build command exited with code ${code}`));

          return;
        }

        resolve(data);
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });

    try {
      await buildCommand.finally(() => {
        // Colorized log output with message about build end
        this.logger.info(colors.cyan('[DistService] Build finished'));
      });

      const assetFile = path.resolve(process.cwd(), this.distZipFolder, this.distZipFilename);

      if (!(await fs.stat(assetFile))) {
        throw new Error(`File ${assetFile} not found`);
      }

      return await fs.readFile(assetFile);
    } catch (e) {
      console.log(e);

      throw e;
    }
  }

  async saveBackupAndBuild(backupFile: Buffer) {
    await this.saveBackup(backupFile);

    return await this.buildNewAssets();
  }
}
