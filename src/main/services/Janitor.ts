import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export class JanitorService {
  private readonly maxAgeDays = 3;

  public runCleanup() {
    console.log('[Janitor] Starting automated SSD cleanup routine...');
    const documentsPath = app.getPath('documents');
    
    // We target Sebooth's heavy media folders
    const sessionsDir = path.join(documentsPath, 'Sebooth', 'Sessions');
    const offlineCacheDir = path.join(documentsPath, 'Sebooth', 'OfflineCache');

    this.sweepDirectory(sessionsDir);
    this.sweepDirectory(offlineCacheDir);
  }

  private sweepDirectory(dirPath: string) {
    if (!fs.existsSync(dirPath)) return;

    try {
      const now = Date.now();
      const maxAgeMs = this.maxAgeDays * 24 * 60 * 60 * 1000;
      
      const items = fs.readdirSync(dirPath);
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          // If the folder itself is older than maxAgeMs, we nuke it recursively
          if (now - stat.birthtimeMs > maxAgeMs) {
            fs.rmSync(fullPath, { recursive: true, force: true });
            console.log(`[Janitor] Swept old session directory: ${item}`);
          }
        } else {
          // If it's a file
          if (now - stat.birthtimeMs > maxAgeMs) {
             fs.unlinkSync(fullPath);
             console.log(`[Janitor] Swept old cache file: ${item}`);
          }
        }
      }
    } catch (e) {
      console.error(`[Janitor] Error sweeping directory ${dirPath}:`, e);
    }
  }
}

export const janitor = new JanitorService();
