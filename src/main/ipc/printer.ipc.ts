import { IpcMain } from 'electron'
import { printerHandler } from '../handlers/PrinterHandler'
import { printQueueService } from '../services/PrintQueueService'
import { PrinterDevice, PrintResult, APIResponse } from '@shared/types'
import * as path from 'path'

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
        filePath: string,
        options: { printer?: string; copies?: number; scale?: 'fit' | 'noscale', sessionId?: string }
    ): Promise<APIResponse<PrintResult>> => {
        try {
            const copies = options.copies || 1
            const sessionId = options.sessionId || path.basename(path.dirname(filePath)) || 'unknown'
            printQueueService.addJob(sessionId, filePath, options.printer || 'Print to PDF', copies)
            return { success: true, data: { success: true }, error: undefined }
        } catch (error) {
            const err = error as Error
            return { success: false, error: err.message }
        }
    })
}
