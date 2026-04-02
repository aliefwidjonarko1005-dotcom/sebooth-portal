const fs = require('fs');
const path = require('path');

const sessionsDir = 'C:\\Users\\AXIOO HYPE R5\\Documents\\Sebooth\\Sessions';

function getDirSize(dirPath) {
  let size = 0;
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      size += getDirSize(filePath);
    } else {
      size += stats.size;
    }
  }
  return size;
}

try {
  const dirs = fs.readdirSync(sessionsDir).filter(f => fs.statSync(path.join(sessionsDir, f)).isDirectory());
  const sizes = dirs.map(dir => {
    const sizeBytes = getDirSize(path.join(sessionsDir, dir));
    return { name: dir, sizeMB: parseFloat((sizeBytes / (1024 * 1024)).toFixed(2)) };
  });
  
  sizes.sort((a, b) => b.sizeMB - a.sizeMB);
  
  const totalSizeMB = sizes.reduce((acc, curr) => acc + curr.sizeMB, 0).toFixed(2);
  const avgSizeMB = (totalSizeMB / sizes.length).toFixed(2);
  
  const output = {
    totalSessions: sizes.length,
    totalSizeMB: totalSizeMB,
    avgSizeMB: avgSizeMB,
    top5Largest: sizes.slice(0, 5),
    top5Smallest: sizes.slice(-5).reverse()
  };

  fs.writeFileSync('tmp_result.json', JSON.stringify(output, null, 2));

} catch (e) {
  fs.writeFileSync('tmp_result.json', JSON.stringify({error: e.message}));
}
