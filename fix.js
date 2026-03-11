const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'src', 'main', 'handlers', 'PrinterHandler.ts');
let code = fs.readFileSync(targetFile, 'utf8');

const printStart = code.indexOf('async print(filePath');
const optionsStart = code.indexOf('async printWithOptions(');

if (printStart > -1 && optionsStart > -1) {
    const fnDef = "    async print(filePath: string, printerName?: string): Promise<PrintResult> {\n" +
        "        return new Promise((resolve) => {\n" +
        "            try {\n" +
        "                // Extract Base64 cleanly\n" +
        "                const imageBase64 = readFileSync(filePath).toString('base64');\n" +
        "                const imgSrc = `data:image/jpeg;base64,${imageBase64}`;\n\n" +
        "                const htmlContent = `\n" +
        "                <!DOCTYPE html>\n" +
        "                <html>\n" +
        "                <head>\n" +
        "                    <style>\n" +
        "                        @page { margin: 0; size: 4in 6in; }\n" +
        "                        body { \n" +
        "                            margin: 0; \n" +
        "                            padding: 0; \n" +
        "                            background: white;\n" +
        "                            overflow: hidden;\n" +
        "                        }\n" +
        "                        canvas {\n" +
        "                            display: block;\n" +
        "                            width: 1200px;\n" +
        "                            height: 1800px;\n" +
        "                        }\n" +
        "                    </style>\n" +
        "                </head>\n" +
        "                <body>\n" +
        "                    <canvas id=\"c\" width=\"1200\" height=\"1800\"></canvas>\n" +
        "                    <script>\n" +
        "                        window.renderComplete = false;\n" +
        "                        const canvas = document.getElementById('c');\n" +
        "                        const ctx = canvas.getContext('2d');\n" +
        "                        \n" +
        "                        const img = new Image();\n" +
        "                        img.onload = () => {\n" +
        "                            ctx.drawImage(img, 0, 0, 600, 1800);\n" +
        "                            ctx.drawImage(img, 600, 0, 600, 1800);\n" +
        "                            setTimeout(() => { window.renderComplete = true; }, 500);\n" +
        "                        };\n" +
        "                        img.onerror = (e) => { \n" +
        "                            console.error('Image load failed');\n" +
        "                            window.renderComplete = true; \n" +
        "                        };\n" +
        "                        img.src = \"${imgSrc}\";\n" +
        "                    </script>\n" +
        "                </body>\n" +
        "                </html>\n" +
        "                `\n" +
        "                const tempHtmlPath = join(app.getPath('temp'), `print_${Date.now()}.html`)\n" +
        "                writeFileSync(tempHtmlPath, htmlContent, 'utf-8')\n\n" +
        "                const printWindow = new BrowserWindow({\n" +
        "                    show: true, // MUST be true for Chromium to composite the hardware canvas\n" +
        "                    opacity: 0, // Make it invisible to the user\n" +
        "                    paintWhenHidden: true,\n" +
        "                    webPreferences: {\n" +
        "                        nodeIntegration: false,\n" +
        "                        contextIsolation: true,\n" +
        "                        webSecurity: false,\n" +
        "                        offscreen: false, \n" +
        "                        backgroundThrottling: false\n" +
        "                    }\n" +
        "                })\n\n" +
        "                printWindow.loadFile(tempHtmlPath)\n\n" +
        "                printWindow.webContents.on('did-finish-load', () => {\n" +
        "                    // Poll until renderComplete is flagged true from inside the canvas script\n" +
        "                    const checkRenderReady = async () => {\n" +
        "                        try {\n" +
        "                            const isReady = await printWindow.webContents.executeJavaScript('window.renderComplete === true');\n" +
        "                            if (!isReady) {\n" +
        "                                setTimeout(checkRenderReady, 100);\n" +
        "                                return;\n" +
        "                            }\n\n" +
        "                            // 1. Generate PDF for testing/verification in the same folder as the strip\n" +
        "                            const pdfPath = join(dirname(filePath), `${basename(filePath, '.jpg')}_4R_Split.pdf`)\n" +
        "                            const pdfBuffer = await printWindow.webContents.printToPDF({\n" +
        "                                pageSize: { width: 101600, height: 152400 },\n" +
        "                                printBackground: true,\n" +
        "                                margins: { top: 0, bottom: 0, left: 0, right: 0 },\n" +
        "                                preferCSSPageSize: true\n" +
        "                            })\n" +
        "                            writeFileSync(pdfPath, pdfBuffer)\n" +
        "                            console.log('Saved 4R Split PDF to:', pdfPath)\n\n" +
        "                            // 2. Actually trigger the physical printer dialog-free\n" +
        "                            const printOptions: Electron.WebContentsPrintOptions = {\n" +
        "                                silent: true,\n" +
        "                                color: true,\n" +
        "                                printBackground: true,\n" +
        "                                pageSize: { width: 101600, height: 152400 }\n" +
        "                            }\n\n" +
        "                            if (printerName && printerName.toLowerCase() !== 'print to pdf') {\n" +
        "                                printOptions.deviceName = printerName\n\n" +
        "                                printWindow.webContents.print(printOptions, (success, failureReason) => {\n" +
        "                                    printWindow.destroy()\n" +
        "                                    try { unlinkSync(tempHtmlPath) } catch (e) { }\n" +
        "                                    if (success) {\n" +
        "                                        resolve({ success: true })\n" +
        "                                    } else {\n" +
        "                                        resolve({ success: false, error: failureReason })\n" +
        "                                    }\n" +
        "                                })\n" +
        "                            } else {\n" +
        "                                printWindow.destroy()\n" +
        "                                try { unlinkSync(tempHtmlPath) } catch (e) { }\n" +
        "                                resolve({ success: true, error: 'Saved PDF verification only' })\n" +
        "                            }\n" +
        "                        } catch (err) {\n" +
        "                            printWindow.destroy()\n" +
        "                            try { unlinkSync(tempHtmlPath) } catch (e) { }\n" +
        "                            resolve({ success: false, error: (err as Error).message })\n" +
        "                        }\n" +
        "                    }\n" +
        "                    checkRenderReady();\n" +
        "                })\n\n" +
        "                printWindow.webContents.on('did-fail-load', () => {\n" +
        "                    printWindow.destroy()\n" +
        "                    try { unlinkSync(tempHtmlPath) } catch (e) { }\n" +
        "                    resolve({ success: false, error: 'Failed to load printing layout' })\n" +
        "                })\n\n" +
        "            } catch (error) {\n" +
        "                resolve({ success: false, error: (error as Error).message })\n" +
        "            }\n" +
        "        })\n" +
        "    }\n\n    /**\n";

    const lastComment = code.lastIndexOf('/**', optionsStart);
    if (lastComment > -1) {
        code = code.substring(0, printStart) + fnDef + code.substring(lastComment + 5);
        fs.writeFileSync(targetFile, code);
        console.log('Done.');
    } else {
        console.log('Error block structure');
    }
}
