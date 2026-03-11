import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { CameraHandler } from './CameraHandler'
import { CameraDevice, CaptureResult } from '@shared/types'

const execAsync = promisify(exec)

/**
 * Direct Shutter Camera Handler (Multi-Engine)
 * Prefers digiCamControl CLI, falls back to DSLR Remote Pro.
 * Both are efficient ways to trigger the 60D via USB tethering.
 */
export class WIAShutterCamera extends CameraHandler {
    private DIGICAM_CLI = 'C:\\Program Files (x86)\\digiCamControl\\CameraControlCmd.exe'
    private BREEZE_CLI = 'C:\\Program Files (x86)\\BreezeSys\\DSLR Remote Pro\\DSlrRemote.exe'

    constructor() {
        super()
    }

    async listCameras(): Promise<CameraDevice[]> {
        return [{
            id: 'dslr_direct_shutter',
            name: 'Canon DSLR (Direct Shutter Mode)',
            port: 'USB',
            connected: true
        }]
    }

    async connect(cameraId: string): Promise<boolean> {
        this.connected = true
        this.currentCamera = { id: cameraId, name: 'Canon DSLR', port: 'USB', connected: true }
        return true
    }

    async disconnect(): Promise<void> {
        this.connected = false
        this.currentCamera = null
    }

    async capture(outputPath: string): Promise<CaptureResult> {
        try {
            console.log('[DirectShutter] Preparing to trigger shutter...')
            
            // 1. Kill potential locking processes to ensure a clean session
            try {
                await execAsync('taskkill /f /im CameraControl.exe /im CameraControlCmd.exe /im DSlrRemote.exe /im EOSUtility.exe /im EOSWebcamUtility.exe', { timeout: 2000 })
            } catch (e) {
                // Ignore errors if processes are not running
            }

            // 2. Try digiCamControl CLI (Robust)
            if (existsSync(this.DIGICAM_CLI)) {
                console.log('[DirectShutter] Using digiCamControl engine...')
                try {
                    // /capture command
                    await execAsync(`"${this.DIGICAM_CLI}" /capture`, { timeout: 15000 })
                    return { success: true, imagePath: outputPath, timestamp: Date.now() }
                } catch (error: any) {
                    console.warn('[DirectShutter] digiCamControl failed:', error.message)
                }
            }

            // 3. Try Breeze Systems DSLR Remote Pro (Fallback)
            if (existsSync(this.BREEZE_CLI)) {
                console.log('[DirectShutter] Using DSLR Remote Pro engine...')
                try {
                    // -c command
                    await execAsync(`"${this.BREEZE_CLI}" -c`, { timeout: 15000 })
                    return { success: true, imagePath: outputPath, timestamp: Date.now() }
                } catch (error: any) {
                    console.warn('[DirectShutter] DSLR Remote Pro failed:', error.message)
                }
            }

            return {
                success: false,
                error: 'Gagal memicu shutter. Pastikan kabel USB terhubung, Live View kamera MATI, dan tutup semua aplikasi kamera lainnya.',
                timestamp: Date.now()
            }
        } catch (error: any) {
            console.error('[DirectShutter] Global Capture error:', error.message)
            return {
                success: false,
                error: `System Error: ${error.message}`,
                timestamp: Date.now()
            }
        }
    }
}
