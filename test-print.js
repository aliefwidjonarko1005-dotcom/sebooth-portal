const ptp = require('pdf-to-printer');
const fs = require('fs');
const path = require('path');

const testPdfPath = 'C:\\Users\\AXIOO HYPE R5\\Documents\\Sebooth\\Sessions\\Session_441f2913-2c8a-47e3-9669-3f017afda1f7\\strip_441f2913-2c8a-47e3-9669-3f017afda1f7_4R_Rotated_1pages.pdf';

ptp.getPrinters()
    .then(printers => {
        console.log('Available Printers:');
        printers.forEach(p => console.log(`  - ${p.deviceId}`));
        
        let targetPrinter = printers.find(p => p.deviceId.includes('Print to PDF'))?.deviceId || printers[0].deviceId;
        console.log(`\nSelected target printer: ${targetPrinter}`);
        
        if (!fs.existsSync(testPdfPath)) {
            console.error('Test PDF not found at:', testPdfPath);
            return;
        }
        
        console.log(`Testing printing with 'noscale' to: ${targetPrinter}`);
        return ptp.print(testPdfPath, { printer: targetPrinter, scale: 'noscale' });
    })
    .then(() => {
        console.log('Print job successfully queued.');
    })
    .catch(err => {
        console.error('Print test failed:', err);
    });
