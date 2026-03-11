const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'src', 'main', 'handlers', 'PrinterHandler.ts');
let code = fs.readFileSync(targetFile, 'utf8');

// 1. Replace the HTML string
const htmlStart = code.indexOf('const htmlContent = `');
const htmlEnd = code.indexOf('`', htmlStart + 21) + 1;

const newHtml = `
                // Convert Windows absolute path to valid file:// URI protocol
                // This is required for Chromium to fetch the local disk image into the headless print view
                const fileUri = 'file:///' + filePath.replace(/\\\\\\\\/g, '/')

                const htmlContent = \\\`
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        @page { margin: 0; size: 4in 6in; }
                        body { 
                            margin: 0; 
                            padding: 0; 
                            width: 1200px; 
                            height: 1800px; 
                            background: white;
                            position: relative;
                            overflow: hidden;
                        }
                        .strip1 {
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 600px;
                            height: 1800px;
                            object-fit: cover;
                        }
                        .strip2 {
                            position: absolute;
                            top: 0;
                            left: 600px;
                            width: 600px;
                            height: 1800px;
                            object-fit: cover;
                        }
                    </style>
                </head>
                <body>
                    <!-- Use explicit file protocol to force Chromium to load disk asset -->
                    <img src="\\\${fileUri}" class="strip1" />
                    <img src="\\\${fileUri}" class="strip2" />
                    
                    <script>
                        // Wait for images to literally finish downloading from local disk
                        window.renderComplete = false;
                        Promise.all(Array.from(document.images).map(img => {
                            if (img.complete) return Promise.resolve(img.naturalHeight !== 0);
                            return new Promise(resolve => {
                                img.addEventListener('load', () => resolve(true));
                                img.addEventListener('error', () => resolve(false));
                            });
                        })).then(() => {
                            window.renderComplete = true;
                        });
                    </script>
                </body>
                </html>
                \\\``;

// Also remove the old base64 strings right above it
const base64Start = code.indexOf('const imageBase64 = readFileSync(filePath).toString(\'base64\')');
if (base64Start > -1) {
    code = code.substring(0, base64Start) + newHtml + code.substring(htmlEnd);
}

// 2. Add webSecurity: false to webPreferences
const oldWebPrefs = `                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                        webSecurity: false // allow local image files from temp html
                    }`;
const newWebPrefs = `                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                        webSecurity: false, // Critical to allow file:// protocols
                        allowRunningInsecureContent: true
                    }`;
code = code.replace(oldWebPrefs, newWebPrefs);

fs.writeFileSync(targetFile, code);
console.log('Successfully patched PrinterHandler.ts with URI protocol method');
