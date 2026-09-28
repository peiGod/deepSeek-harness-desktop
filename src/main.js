const { app, BrowserWindow, Menu } = require('electron')
const path = require('path')
const { exec, execFile } = require('child_process')
const net = require('net')
let dshProcess
let mainWin

// 检测端口是否监听成功
function waitPortReady(port, host = '127.0.0.1', timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    function check() {
      const socket = new net.Socket()
      socket.setTimeout(1000)
      socket.on('connect', () => {
        socket.destroy()
        resolve(true)
      })
      socket.on('error', () => {
        socket.destroy()
        if (Date.now() - startTime > timeout) {
          return reject(new Error('等待服务启动超时'))
        }
        setTimeout(check, 800)
      })
      socket.connect(port, host)
    }
    check()
  })
}

async function createWindow() {
  // 1. 启动 npx @deepseek-ai/dsh web
  const isWin = process.platform === 'win32';

  dshProcess = execFile(
    isWin ? process.env.ComSpec || 'cmd.exe' : 'npx',
    isWin ? ['/c', 'npx', '@deepseek-ai/dsh', 'web'] : ['@deepseek-ai/dsh', 'web'],
    {
      cwd: app.getAppPath(),
      env: { ...process.env },
      stdio: 'pipe',
    }
  );
  console.log('dsh web服务启动中...')

  dshProcess.on('close', code => {
    console.log('dsh 子进程退出 code=', code)
  })

  try {
    await waitPortReady(3080);
    console.log('dsh web服务已启动,打开窗口')

    mainWin = new BrowserWindow({
      width: 800,
      height: 600,
      icon: path.join(__dirname, './build/icon.png'), // 窗口左上角图标
      webPreferences: {
        nodeIntegration: true,
      }
    })

    // 打开开发者工具控制台
    if (process.env.NODE_ENV === 'development') {
      // mainWin.webContents.openDevTools();
      mainWin.loadURL('http://127.0.0.1:3080')
    } else {
      mainWin.loadURL('http://127.0.0.1:3080')
    }

    mainWin.on('closed', () => {
      mainWin = null
    })
  } catch (error) {
    console.error('dsh web服务启动失败:', error.message)
  }

}

app.whenReady().then(() => {
  createWindow()
  Menu.setApplicationMenu(null)
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 重点：electron退出时，杀死npx子进程，释放3080端口
app.on('before-quit', () => {
  if (dshProcess && !dshProcess.killed) {
    if (process.platform === 'win32') {
      // windows杀子进程组
      exec(`taskkill /F /T /PID ${dshProcess.pid}`)
    } else {
      dshProcess.kill('SIGTERM')
    }
  }
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})
