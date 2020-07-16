const {app, BrowserWindow,ipcRenderer} = require("electron");
var os = require("os");

var electronApp = require("express")();
var http = require("http").Server(electronApp);
var io = require("socket.io")(http);

const mainWindow = require("./windows/main");



app.setAppUserModelId("flucemedia.rave");
app.on("ready",function() {
    mainWindow.createWindow()
});

module.exports = {
    io: io
}