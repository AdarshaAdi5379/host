const { execSync } = require('child_process');
console.log("Looking at UI via curl...");
const res = execSync('curl -s http://localhost:5173/dashboard');
if (res.toString().includes('Malware Alert!')) {
    console.log("BANNER FOUND IN HTML SOURCE");
} else {
    console.log("BANNER NOT FOUND. Since React is CSR, looking at source code.");
}
