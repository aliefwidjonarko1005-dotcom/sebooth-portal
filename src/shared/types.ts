// =====================
// Shared Types for Sebooth Photobooth Application
// =====================

// Camera Types
export interface CameraDevice {
    id: string
    name: string
    port: string
    connected: boolean
}

export interface CaptureResult {
    success: boolean
    imagePath?: string
    error?: string
    timestamp: number
}

export interface CameraHandler {
    listCameras(): Promise<CameraDevice[]>
    connect(cameraId: string): Promise<boolean>
    disconnect(): Promise<void>
    capture(outputPath: string): Promise<CaptureResult>
    isConnected(): boolean
}

// Printer Types
export interface PrinterDevice {
    name: string
    isDefault: boolean
}

export interface PrintResult {
    success: boolean
    error?: string
}

// Frame & Photo Slot Types
export interface PhotoSlot {
    id: string
    x: number
    y: number
    width: number
    height: number
    rotation: number
    duplicateOfSlotId?: string  // If set, this slot uses the same photo as the referenced slot
}

export interface FrameConfig {
    id: string
    name: string
    overlayPath: string
    slots: PhotoSlot[]
    canvasWidth: number
    canvasHeight: number
}

// Session Types
export interface CapturedPhoto {
    slotId: string
    imagePath: string
    timestamp: number
    filter?: string
    videoPath?: string  // 5-second video before capture for Live Photo
}

export interface SessionData {
    id: string
    frameId: string
    photos: CapturedPhoto[]
    email?: string
    createdAt: number
    compositePath?: string
}

// Config Types
export interface AppConfig {
    countdownDuration: number // seconds
    previewDuration: number // seconds
    sessionTimeout: number // seconds (legacy, kept for compatibility)
    activeFrameIds: string[]  // Multiple frames can be active
    timerEnabled: boolean // Enable/disable countdown timer

    // Printer
    printerEnabled: boolean // Enable/disable auto printing
    printerName: string // Selected printer name

    // Per-session timeouts
    frameSelectionTimeout: number // seconds - timeout for frame selection page
    captureTimeout: number // seconds - timeout for capture session
    postProcessingTimeout: number // seconds - timeout for post processing
    sessionTimerEnabled: boolean // Enable/disable per-session timers
    // Payment Gateway
    paymentEnabled: boolean // Enable/disable payment before capture
    sessionPrice: number // Base price for 1 session (includes 1 4R print)
    additionalPrintPrice: number // Price per 2 additional prints
    midtransClientKey: string // Midtrans client key for QRIS
    midtransServerKey: string // Midtrans server key for API
    paymentInstructions: string // Payment instructions displayed to user
    paymentTimeout: number // seconds - timeout for payment page

    // Camera
    cameraMode: 'mock' | 'dslr' | 'ptp' // Mock (webcam), DSLR (CLI), or PTP (Direct)
    selectedCameraId?: string // Device ID for USB capture card / specific webcam

    // Sharing
    sharingMode: 'cloud' | 'local' // Cloud (Drive/Supabase) or Local WiFi (DSLRBooth mode)
    wifiSsid?: string
    wifiPassword?: string
}

export interface LUTFilter {
    id: string
    name: string
    cubePath: string
    previewPath?: string
}

// Admin Types
export interface AdminCredentials {
    password: string
}

// IPC Channel Types
export type CameraIPCChannels =
    | 'camera:list'
    | 'camera:connect'
    | 'camera:disconnect'
    | 'camera:capture'
    | 'camera:status'

export type PrinterIPCChannels =
    | 'printer:list'
    | 'printer:print'
    | 'printer:status'

export type SystemIPCChannels =
    | 'system:open-file-dialog'
    | 'system:get-temp-path'
    | 'system:save-file'
    | 'system:generate-hq-gif'

export type ImageIPCChannels =
    | 'image:composite'
    | 'image:apply-filter'
    | 'image:generate-gif'

// Supabase Types
export interface SessionLog {
    id?: string
    email: string
    photo_url: string
    created_at?: string
    metadata?: Record<string, unknown>
}

export interface ConfigRecord {
    id?: string
    key: string
    value: Record<string, unknown>
    updated_at?: string
}

// API Response Types
export interface APIResponse<T> {
    success: boolean
    data?: T
    error?: string
}
