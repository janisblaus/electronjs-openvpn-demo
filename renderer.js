var ipc = require('electron').ipcRenderer;

ipc.on('store-data', function (event,store) {
	var log = document.querySelector(".openvpn-log");
	log.innerHTML += '<div>' + store + '</div>'

	log.scrollTop = log.scrollHeight;
});

ipc.on('set-public-ip', function (event,data) {
	document.querySelector(".public-ip").innerHTML = data;
});

ipc.on('bandwidth', function (event,bandwidth) {
	document.querySelector(".bandwidth-in").innerHTML = formatBytes(bandwidth[0]);
	document.querySelector(".bandwidth-out").innerHTML = formatBytes(bandwidth[1]);
});

document.querySelector('.disconnect').addEventListener('click', function (event) {
  ipc.send('disconnect')
})

document.querySelector('.connect').addEventListener('click', function (event) {
  ipc.send('connect')
})


function formatBytes(bytes,decimals) {
   if(bytes == 0) return '0 Bytes';
   var k = 1024,
       dm = decimals <= 0 ? 0 : decimals || 2,
       sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
       i = Math.floor(Math.log(bytes) / Math.log(k));
   return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}