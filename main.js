// Modules to control application life and create native browser window
const {app, BrowserWindow, ipcMain} = require('electron')
const { exec, execFileSync, execFile } = require('child_process');
const publicIp = require('public-ip');
const openvpnmanager = require('node-openvpn')


const MANAGEMENT_PORT = 1347;

const LOGIN_CREDENTIALS = {
    user: 'test@netcore.lv',
    pass: 'Rand0m123'
};


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow, ovpnConsoleProcess, openvpn, currentIP;

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', initialise)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.once('before-quit', () => {
    stopVPNService()
    mainWindow.removeAllListeners('close');
});


app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    initialise()
  }
})

ipcMain.on('disconnect', (event) => {  
  stopVPNService()
});

ipcMain.on('connect', (event) => {  
  startVPNService()
});


function initialise(){
  createWindow()
}


function getOpenVPNPath() {
    switch (process.platform) {
        case 'win32':
            return app.getAppPath() + '/bin/win/openvpn'
            break;
        case 'darwin':
            return '/usr/local/opt/openvpn/sbin/openvpn';
        case 'linux':
            return '/usr/local/opt/openvpn/sbin/openvpn';
            break;
    }    
}

function startVPNService(){

  /*
  * Daemon service ----------------
  */

  if( !ovpnConsoleProcess ){
    logThis('Starting VPN Service')

    let args = [
      '--config', app.getAppPath() + '/config/config.ovpn',
      '--management', '0.0.0.0', MANAGEMENT_PORT,
      '--management-hold',
      '--management-query-passwords'
    ]

    if( process.platform == 'win32' ){
      args.push('--register-dns')
    }

    console.log(getOpenVPNPath())

    ovpnConsoleProcess = execFile( getOpenVPNPath(), args)

    //no need as we get everything from openvpnmanager
    ovpnConsoleProcess.stdout.on('data', function(data) {
      logThis('stdout: ' + data);
    });
    
    ovpnConsoleProcess.stderr.on('data', function(data) {
        logThis('stderr: ' + data)
    });

    ovpnConsoleProcess.on('close', function(code) {
        logThis('closing code: ' + code)
    });
  }



  /*
  * Manager ----------------
  */
  if( !openvpn ){
    setTimeout(startManagerService, 3000)
  }
}

function startManagerService(){
  logThis('Connecting VPN Manager Service')

  openvpn = openvpnmanager.connect({
    host: '127.0.0.1',
    port: MANAGEMENT_PORT, //port openvpn management console
    timeout: 5500, //timeout for connection - optional, will default to 1500ms if undefined
  })
   
  // will be emited on successful interfacing with openvpn instance
  openvpn.on('connected', () => {
    openvpnmanager.authorize( LOGIN_CREDENTIALS );
  });
   
  // emits console output of openvpn instance as a string
  openvpn.on('console-output', output => {
    logThis(output)
  });
   
  // emits console output of openvpn state as a array
  openvpn.on('state-change', state => {
    logThis('-----------------------------------------')
    logThis('STATECHANGE: ' + state)
    logThis('-----------------------------------------')
    updateIpAddress()
  })
  
  openvpn.on('bytecount', bandwidth => {
      mainWindow.webContents.send('bandwidth', bandwidth)
  })

  // emits console output of openvpn state as a string
  openvpn.on('error', error => {
    console.log(error)
    updateIpAddress()
  })
}

function stopVPNService(){
  if( openvpn ){
    openvpnmanager.disconnect()
     
    // emits on disconnect
    openvpn.on('disconnected', () => {
      // finally destroy the disconnected manager 
      openvpnmanager.destroy()
    })
  }

  openvpn = false

  if( ovpnConsoleProcess ){
      console.log('kill process id: ' + ovpnConsoleProcess.pid)
      ovpnConsoleProcess.kill()
  }

  if( mainWindow ){
    mainWindow.webContents.send('bandwidth', ['0','0'])
  }

  ovpnConsoleProcess = false


  updateIpAddress()
}


function createWindow () {

  // Create the browser window.
  mainWindow = new BrowserWindow({width: 500, height: 750})

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  mainWindow.webContents.once('dom-ready', () => {
      updateIpAddress()
  })

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
    
    stopVPNService()
  })
}

function updateIpAddress(){
  publicIp.v4().then(ip => {
    if( currentIP != ip ){
      logThis( 'current ip : ' + ip )
      mainWindow.webContents.send('set-public-ip', ip)
      currentIP = ip
    }
  });
}


function logThis(string){
  //log to console
   console.log(string);

  //send to renderer
  if( mainWindow ){
    mainWindow.webContents.send('store-data', string);
  }
}