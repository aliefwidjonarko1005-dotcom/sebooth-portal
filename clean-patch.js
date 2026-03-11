const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'src', 'main', 'handlers', 'PrinterHandler.ts');
let code = fs.readFileSync(targetFile, 'utf8');

const printStart = code.indexOf('async print(filePath: string, printerName?: string): Promise<PrintResult> {');
const optionsStart = code.indexOf('async printWithOptions(');

if (printStart > -1 && optionsStart > -1) {
    const fnDef = `async print(filePath: string, printerName?: string): Promise<PrintResult> {
        return new Promise((resolve) => {
            try {
                // Generate 4R Split HTML Layout 
                // A 4R paper is 4x6 inches. We place two 2x6 strips side-by-side.

                // Extract Base64 cleanly to bypass local network file restrictions completely
                const imageBase64 = fs.readFileSync(filePath).toString('base64');
                const imgSrc = "data:image/jpeg;base64," + imageBase64;

                const htmlContent = [
                    '<!DOCTYPE html>',
                    '<html>',
                    '<head>',
                    '    <style>',
                    '        @page { margin: 0; size: 4in 6in; }',
                    '        body { ',
                    '            margin: 0; ',
                    '            padding: 0; ',
                    '            background: white;',
                    '            overflow: hidden;',
                    '        }',
                    '        canvas {',
                    '            display: block;',
                    '            width: 1200px;',
                    '            height: 1800px;',
                    '        }',
                    '    </style>',
                    '</head>',
                    '<body>',
                    '    <canvas id="c" width="1200" height="1800"></canvas>',
                    '    <script>',
                    '        window.renderComplete = false;',
                    '        const canvas = document.getElementById("c");',
                    '        const ctx = canvas.getContext("2d");',
                    '        ',
                    '        const img = new Image();',
                    '        img.onload = () => {',
                    '            ctx.drawImage(img, 0, 0, 600, 1800);',
                    '            ctx.drawImage(img, 600, 0, 600, 1800);',
                    '            // Hardware acceleration delay to ensure GPU flush',
                    '            setTimeout(() => { window.renderComplete = true; }, 500);',
                    '        };',
                    '        img.onerror = (e) => { ',
                    '            console.error("Image load failed");',
                    '            window.renderComplete = true; ',
                    '        };',
                    '        img.src = "' + imgSrc + '";',
                    '    </script>',
                    '</body>',
                    '</html>'
                ].join("\\n");

                const tempHtmlPath = join(app.getPath('temp'), 'print_' + Date.now() + '.html');
                writeFileSync(tempHtmlPath, htmlContent, 'utf-8')

                const printWindow = new BrowserWindow({
                    show: false,
                    paintWhenHidden: true, // Crucial for PDF generation of hidden canvas
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                        webSecurity: false,
                        offscreen: false, // Do not use offscreen mode; it breaks printToPDF sometimes
                        backgroundThrottling: false
                    }
                })

                printWindow.loadFile(tempHtmlPath)

                printWindow.webContents.on('did-finish-load', () => {
                    // Poll until renderComplete is flagged true from inside the canvas script
                    const checkRenderReady = async () => {
                        try {
                            const isReady = await printWindow.webContents.executeJavaScript('window.renderComplete === true');
                            if (!isReady) {
                                setTimeout(checkRenderReady, 100);
                                return;
                            }

                            // 1. Generate PDF for testing/verification in the same folder as the strip
                            const pdfPath = join(dirname(filePath), basename(filePath, '.jpg') + '_4R_Split.pdf');
                            const pdfBuffer = await printWindow.webContents.printToPDF({
                                pageSize: { width: 101600, height: 152400 }, // 4x6 inches in microns
                                printBackground: true,
                                margins: { top: 0, bottom: 0, left: 0, right: 0 },
                                preferCSSPageSize: true
                            })
                            writeFileSync(pdfPath, pdfBuffer)
                            console.log('Saved 4R Split PDF to:', pdfPath)

                            // 2. Actually trigger the physical printer dialog-free
                            const printOptions = {
                                silent: true,
                                color: true,
                                printBackground: true,
                                pageSize: { width: 101600, height: 152400 }
                            }

                            if (printerName && printerName.toLowerCase() !== 'print to pdf') {
                                printOptions.deviceName = printerName

                                printWindow.webContents.print(printOptions, (success, failureReason) => {
                                    printWindow.destroy()
                                    try { unlinkSync(tempHtmlPath) } catch (e) { }
                                    if (success) {
                                        resolve({ success: true })
                                    } else {
                                        resolve({ success: false, error: failureReason })
                                    }
                                })
                            } else {
                                // If no physical printer configured, just finish successfully with the PDF
                                printWindow.destroy()
                                try { unlinkSync(tempHtmlPath) } catch (e) { }
                                resolve({ success: true, error: 'Saved PDF verification only' })
                            }
                        } catch (err) {
                            printWindow.destroy()
                            try { unlinkSync(tempHtmlPath) } catch (e) { }
                            resolve({ success: false, error: err.message })
                        }
                    }
                    
                    // Start polling
                    checkRenderReady();
                })

                printWindow.webContents.on('did-fail-load', () => {
                    printWindow.destroy()
                    try { unlinkSync(tempHtmlPath) } catch (e) { }
                    resolve({ success: false, error: 'Failed to load printing layout' })
                })

            } catch (error) {
                resolve({ success: false, error: error.message })
            }
        })
    }

    /**
     * Print with specific options
     */
    `;

    // We isolate just up to the "/**" for printWithOptions
    const startOfOptions = code.lastIndexOf('/**\\n     * Print with specific options', optionsStart);
    if (startOfOptions > -1) {
        code = code.substring(0, printStart) + fnDef + code.substring(startOfOptions);
        fs.writeFileSync(targetFile, code);
        console.log('Successfully rewrote PrinterHandler.ts');
    } else {
        console.log('Could not find start of options doc block.');
    }
} else {
    console.log('Could not find fn boundaries');
} `;
