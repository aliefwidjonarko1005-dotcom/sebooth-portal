import { ElectronAPI } from '@electron-toolkit/preload'
import { SetupConfig } from '../shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      system: any
      camera: any
      frame: any
      session: any
      database: any
      drive: any
      printer: any
      store: any
    }
  }
}
