const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'src', 'main', 'handlers', 'PrinterHandler.ts');
let code = fs.readFileSync(targetFile, 'utf8');

if (!code.includes("import { PDFDocument } from 'pdf-lib'")) {
    code = code.replace("import { join, dirname, basename } from 'path'", "import { join, dirname, basename } from 'path'\nimport { PDFDocument } from 'pdf-lib'\nimport ptp from 'pdf-to-printer'");
}

const printStart = code.indexOf('    async print(filePath: string, printerName?: string): Promise<PrintResult> {');

if (printStart > -1) {
    const fnDef = `    async print(filePath: string, printerName?: string): Promise<PrintResult> {
        return new Promise(async (resolve) => {
            try {
                // 1. Generate 4R Split PDF using native pdf-lib
                const pdfDoc = await PDFDocument.create();
                
                // 4x6 inches in PDF points (72 points per inch) -> 288 x 432
                const page = pdfDoc.addPage([288, 432]);
                
                const imageBytes = fs.readFileSync(filePath);
                const image = await pdfDoc.embedJpg(imageBytes);
                
                // Draw strip 1 (Left half)
                page.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: 144,
                    height: 432
                });
                // Draw strip 2 (Right half)
                page.drawImage(image, {
                    x: 144,
                    y: 0,
                    width: 144,
                    height: 432
                });
                
                const pdfBytes = await pdfDoc.save();
                const pdfPath = path.join(path.dirname(filePath), path.basename(filePath, '.jpg') + '_4R_Split.pdf');
                fs.writeFileSync(pdfPath, pdfBytes);
                console.log('Saved Native 4R Split PDF to:', pdfPath);

                // 2. Trigger physical printer dialog-free
                if (printerName && printerName.toLowerCase() !== 'print to pdf') {
                    try {
                        // Use pdf-to-printer for reliable, headless native Windows printing
                        await ptp.print(pdfPath, { printer: printerName });
                        resolve({ success: true });
                    } catch (printErr) {
                        resolve({ success: false, error: printErr.message });
                    }
                } else {
                    resolve({ success: true, error: 'Saved PDF verification only' });
                }
            } catch (error) {
                resolve({ success: false, error: error.message });
            }
        });
    }

    /**
     * Print with specific options
     */
    async printWithOptions(
        filePath: string,
        options: {
            printer?: string
            copies?: number
            scale?: 'fit' | 'noscale'
        }
    ): Promise<PrintResult> {
        try {
            const copies = options.copies || 1
            for (let i = 0; i < copies; i++) {
                const result = await this.print(filePath, options.printer)
                if (!result.success) return result
                // Small delay between spooling jobs
                await new Promise(resolve => setTimeout(resolve, 500))
            }
            return { success: true }
        } catch (error) {
            const err = error as Error
            return {
                success: false,
                error: err.message
            }
        }
    }
}

`;

    const lastComment = code.lastIndexOf('// Singleton instance');
    if (lastComment > -1) {
        code = code.substring(0, printStart) + fnDef + code.substring(lastComment);
        fs.writeFileSync(targetFile, code);
        console.log('Rewrote PrinterHandler.ts for pdf-lib successfully.');
    } else {
        console.log('Error block structure');
    }
} else {
    console.log('Failed to find print function');
}
