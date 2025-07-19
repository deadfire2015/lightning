const express = require('express');
const path = require('path');
const os = require('os');

// 创建express应用
const app = express();
const port = 3000;

// 获取本地IP地址
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const localIp = getLocalIpAddress();

// 设置静态文件目录（当前目录）
app.use(express.static(path.join(__dirname)));

// 启动服务器
app.listen(port, () => {
    console.log(`本地服务器已启动:`);
    console.log(`- 本机访问: http://localhost:${port}`);
    console.log(`- 局域网访问: http://${localIp}:${port}`);
    console.log(`服务目录: ${__dirname}`);
});

// 处理404
app.use((req, res) => {
    res.status(404).send('404 - 页面未找到');
});