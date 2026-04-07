import { IpcMain } from 'electron'
import { printerHandler } from '../handlers/PrinterHandler'
import { printQueueService } from '../services/PrintQueueService'
import { PrinterDevice, PrintResult, APIResponse } from '@shared/types'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

/**
 * Register all printer-related IPC handlers
 */
export function registerPrinterHandlers(ipcMain: IpcMain): void {

    // List available printers
    ipcMain.handle('printer:list', async (): Promise<APIResponse<PrinterDevice[]>> => {
        try {
            const printers = await printerHandler.listPrinters()
            return { success: true, data: printers }
        } catch (error) {
            const err = error as Error
            return { success: false, error: err.message }
        }
    })

    // Get default printer
    ipcMain.handle('printer:default', async (): Promise<APIResponse<PrinterDevice | null>> => {
        try {
            const printer = await printerHandler.getDefaultPrinter()
            return { success: true, data: printer }
        } catch (error) {
            const err = error as Error
            return { success: false, error: err.message }
        }
    })

    // Read current queue and history
    ipcMain.handle('printer:get-queue', async () => {
        return { success: true, data: printQueueService.getQueue() }
    })
    ipcMain.handle('printer:get-history', async () => {
        return { success: true, data: printQueueService.getHistory() }
    })

    // Print a file silently (Routed through the queue)
    ipcMain.handle('printer:print', async (_, filePath: string, printerName?: string): Promise<APIResponse<PrintResult>> => {
        try {
            const sessionId = path.basename(path.dirname(filePath)) || 'unknown'
            printQueueService.addJob(sessionId, filePath, printerName || 'Print to PDF', 1)
            return { success: true, data: { success: true }, error: undefined }
        } catch (error) {
            const err = error as Error
            return { success: false, error: err.message }
        }
    })

    // Print with options (Routed through the queue)
    ipcMain.handle('printer:print-with-options', async (
        _,
        options: { printerName: string; data: string; copies: number; options?: any }
    ): Promise<APIResponse<PrintResult>> => {
        console.log('[IPC] printer:print-with-options called with options:', options)
        console.log('[IPC] options type:', typeof options)
        console.log('[IPC] options keys:', Object.keys(options || {}))
        
        try {
            const { printerName, data, copies } = options
            console.log('[IPC] destructured - printerName:', printerName, 'data length:', data?.length, 'copies:', copies)
            
            // Save base64 data to temp file
            const base64Data = data.replace(/^data:image\/jpeg;base64,/, '')
            console.log('[IPC] base64Data length after strip:', base64Data.length)
            const buffer = Buffer.from(base64Data, 'base64')
            console.log('[IPC] buffer length:', buffer.length)
            const tempDir = os.tmpdir()
            const tempFilePath = path.join(tempDir, `print_${Date.now()}.jpg`)
            fs.writeFileSync(tempFilePath, buffer)
            console.log('[IPC] Saved base64 data to temp file: ${tempFilePath}, file size:', fs.statSync(tempFilePath).size)
            
            const sessionId = 'printing_page'
            
            printQueueService.addJob(sessionId, tempFilePath, printerName, copies)
            
            console.log('[IPC] Job added successfully')
            return { success: true, data: { success: true }, error: undefined }
        } catch (error) {
            const err = error as Error
            console.error('[IPC] Error in printer:print-with-options:', err)
            return { success: false, error: err.message }
        }
    })
}
