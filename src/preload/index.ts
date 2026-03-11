import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
    CameraDevice,
    CaptureResult,
    PrinterDevice,
    PrintResult,
    PhotoSlot,
    APIResponse
} from '../shared/types'

// Custom APIs for renderer
const api = {
    // Camera APIs
    camera: {
        list: (): Promise<APIResponse<CameraDevice[]>> =>
            ipcRenderer.invoke('camera:list'),

        connect: (cameraId: string): Promise<APIResponse<boolean>> =>
            ipcRenderer.invoke('camera:connect', cameraId),

        disconnect: (): Promise<APIResponse<void>> =>
            ipcRenderer.invoke('camera:disconnect'),

        capture: (slotId?: string): Promise<APIResponse<CaptureResult>> =>
            ipcRenderer.invoke('camera:capture', slotId),

        status: (): Promise<APIResponse<{ connected: boolean; camera: CameraDevice | null }>> =>
            ipcRenderer.invoke('camera:status'),

        useMock: (): Promise<APIResponse<void>> =>
            ipcRenderer.invoke('camera:use-mock'),

        useReal: (): Promise<APIResponse<void>> =>
            ipcRenderer.invoke('camera:use-real'),

        useDirectPtp: (): Promise<APIResponse<void>> =>
            ipcRenderer.invoke('camera:use-direct-ptp')
    },

    // Printer APIs
    printer: {
        list: (): Promise<APIResponse<PrinterDevice[]>> =>
            ipcRenderer.invoke('printer:list'),

        getDefault: (): Promise<APIResponse<PrinterDevice | null>> =>
            ipcRenderer.invoke('printer:default'),

        print: (filePath: string, printerName?: string): Promise<APIResponse<PrintResult>> =>
            ipcRenderer.invoke('printer:print', filePath, printerName),

        printWithOptions: (
            filePath: string,
            options: { printer?: string; copies?: number; scale?: 'fit' | 'noscale' }
        ): Promise<APIResponse<PrintResult>> =>
            ipcRenderer.invoke('printer:print-with-options', filePath, options)
    },

    // System APIs
    system: {
        openFileDialog: (options: {
            title?: string
            filters?: { name: string; extensions: string[] }[]
            multiple?: boolean
        }): Promise<APIResponse<string[]>> =>
            ipcRenderer.invoke('system:open-file-dialog', options),

        getTempPath: (): Promise<APIResponse<string>> =>
            ipcRenderer.invoke('system:get-temp-path'),

        getLocalIp: (): Promise<APIResponse<string | null>> =>
            ipcRenderer.invoke('system:get-local-ip'),

        getUserDataPath: (): Promise<APIResponse<string>> =>
            ipcRenderer.invoke('system:get-user-data-path'),

        copyFile: (source: string, destination: string): Promise<APIResponse<string>> =>
            ipcRenderer.invoke('system:copy-file', source, destination),

        readJson: <T>(filePath: string): Promise<APIResponse<T>> =>
            ipcRenderer.invoke('system:read-json', filePath),

        writeJson: (filePath: string, data: unknown): Promise<APIResponse<void>> =>
            ipcRenderer.invoke('system:write-json', filePath, data),

        fileExists: (filePath: string): Promise<APIResponse<boolean>> =>
            ipcRenderer.invoke('system:file-exists', filePath),

        readFileAsBase64: (filePath: string): Promise<APIResponse<string>> =>
            ipcRenderer.invoke('system:read-file-base64', filePath),

        saveDataUrl: (dataUrl: string, filename: string): Promise<APIResponse<string>> =>
            ipcRenderer.invoke('system:save-data-url', dataUrl, filename),

        saveSessionLocally: (params: {
            sessionId: string
            stripDataUrl?: string
            gifDataUrl?: string
            photos: { path: string; filename: string }[]
            videos: { path: string; filename: string }[]
            overlay?: { path: string; filename: string }
            frameConfig?: {
                width: number
                height: number
                slots: { width: number; height: number; x: number; y: number }[]
            }
        }): Promise<APIResponse<{ path: string; filename: string; mimeType: string }[]>> =>
            ipcRenderer.invoke('system:save-session-locally', params),

        generateHqGif: (framesBase64: string[], delayMs: number): Promise<APIResponse<string>> =>
            ipcRenderer.invoke('system:generate-hq-gif', framesBase64, delayMs),

        renameSessionFolder: (params: { sessionId: string; email: string }): Promise<APIResponse<string>> =>
            ipcRenderer.invoke('system:rename-session-folder', params),

        findSessionStrip: (sessionId: string): Promise<APIResponse<string>> =>
            ipcRenderer.invoke('system:find-session-strip', sessionId)
    },

    // Image APIs
    image: {
        composite: (options: {
            photos: { path: string; slot: PhotoSlot }[]
            framePath: string
            outputPath: string
            canvasWidth: number
            canvasHeight: number
        }): Promise<APIResponse<string>> =>
            ipcRenderer.invoke('image:composite', options),

        resize: (options: {
            inputPath: string
            outputPath: string
            width: number
            height: number
            fit?: 'cover' | 'contain' | 'fill'
        }): Promise<APIResponse<string>> =>
            ipcRenderer.invoke('image:resize', options),

        applyFilter: (options: {
            inputPath: string
            outputPath: string
            filter: {
                brightness?: number
                contrast?: number
                saturation?: number
                grayscale?: boolean
                sepia?: boolean
            }
        }): Promise<APIResponse<string>> =>
            ipcRenderer.invoke('image:apply-filter', options),

        generateGif: (options: {
            imagePaths: string[]
            outputPath: string
            delay?: number
            width?: number
            height?: number
        }): Promise<APIResponse<string>> =>
            ipcRenderer.invoke('image:generate-gif', options),

        metadata: (imagePath: string): Promise<APIResponse<{
            width: number
            height: number
            format: string
        }>> =>
            ipcRenderer.invoke('image:metadata', imagePath)
    },

    // Email APIs
    email: {
        send: (params: {
            to: string
            sessionId: string
            galleryUrl: string
            photoStripUrl?: string
            photoUrls?: string[]
        }): Promise<{ success: boolean; error?: string; messageId?: string }> =>
            ipcRenderer.invoke('email:send', params),

        isConfigured: (): Promise<boolean> =>
            ipcRenderer.invoke('email:is-configured')
    },

    // Drive APIs
    drive: {
        uploadSession: (params: {
            sessionId: string
            files: { path: string; filename: string; mimeType: string }[]
        }): Promise<{ success: boolean; error?: string; folderUrl?: string; folderId?: string; files?: { filename: string; url: string; id: string }[] }> =>
            ipcRenderer.invoke('drive:upload-session', params)
    },

    // Window APIs
    window: {
        toggleFullscreen: (): Promise<boolean> =>
            ipcRenderer.invoke('window:toggle-fullscreen'),

        toggleKiosk: (): Promise<boolean> =>
            ipcRenderer.invoke('window:toggle-kiosk')
    }
}

// Expose APIs to renderer
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', electronAPI)
        contextBridge.exposeInMainWorld('api', api)
    } catch (error) {
        console.error(error)
    }
} else {
    // @ts-ignore (define in dts)
    window.electron = electronAPI
    // @ts-ignore (define in dts)
    window.api = api
}
