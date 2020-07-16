const {app, BrowserWindow,ipcRenderer,ipcMain,dialog} = require("electron");
var window;

var accountHandler;
var libraryHandler;
var notificationHandler;
var tracklistHandler;

const path = require("path");

function createWindow() {
    window = new BrowserWindow({
        width: 1100,
        height: 700,
        frame: false,
        minHeight: 700,
        minWidth: 1100,
        icon: "assets/images/logo_circle.png"
    });
    window.setMenu(null);
    window.loadFile("index.html");

    if(typeof accountHandler === "undefined") accountHandler = require("../system/accountHandler");
    if(typeof libraryHandler === "undefined") libraryHandler = require("../system/libraryHandler");
    if(typeof notificationHandler === "undefined") notificationHandler = require("../system/notificationHandler");
    if(typeof tracklistHandler === "undefined") tracklistHandler = require("../system/tracklistHandler");

    ipcMain.on("request-login",function(event) {
        accountHandler.initialize()
            .then(function() {
                libraryHandler.initialize().then(()=> {
                    event.sender.send("login-response", {
                        loggedIn: accountHandler.loggedIn,
                        userData: accountHandler.packUserData()
                    });
                });
            });
    });

    ipcMain.on("login",function(event,data) {
        if(data.type==="guest") accountHandler.performLogin({type:"guest"});
        window.webContents.send("account-update",accountHandler.packUserData())
    });

    ipcMain.on("logout",function() {
        accountHandler.logout();
    });

    ipcMain.on("load-content",function(event,data) {
        var page = data.page;
        var timestamp = data.timestamp;

        var target = "404.html";
        switch(page) {
            case "home": target = "frames/home.html";
        }

        event.sender.send("content-received",{pass:true,lastRequest:timestamp,path:target});
    });

    ipcMain.on("username",function(event,data) {
        accountHandler.initialize().then(function() {
            event.sender.send("username",accountHandler.username);
        });
    });

    ipcMain.on("libraries",function(event) {
        libraryHandler.initialize().then(()=>{
            event.sender.send("libraries",libraryHandler.sources);
        });
    });

    ipcMain.on("tracks",function(event,data) {
        const identifier = data.identifier;
        libraryHandler.initialize().then(()=>{
            libraryHandler.getTracks(identifier).then((tracks)=>{
                event.sender.send("tracks",{identifier:identifier,tracks:tracks});
            })
        })
    });

    notificationHandler.listenToNotifications(function(notification) {
        window.webContents.send("new-notification",{notification:notification});
    });

    ipcMain.on("select-library",function(event) {
        dialog.showOpenDialog(window,{
            properties: ["openDirectory"]
        },(directoryName) => {
            if(typeof directoryName !== "undefined")
                libraryHandler.initialize().then(()=>{
                    directoryName.forEach(function(directory) {
                        event.sender.send("add-library",{library:directory});
                        libraryHandler.addLibrary(directory,(type,data)=>{
                            if(type==="done") {
                                libraryHandler.getTracks(data.identifier).then((tracks)=>{
                                    event.sender.send("tracks",{identifier:data.identifier,tracks:tracks});
                                })
                            }
                        });
                    });
                });

        })
    });

    ipcMain.on("request-track",function () {
        tracklistHandler.initialize();
    });

    ipcMain.on("play-track",function(event, data) {
        const sid = data.sid;
        const id = data.id;
        const queue = data.queue;

        console.log(sid+" "+id+" "+queue)

        tracklistHandler.startQueueFromTag(queue,sid,id);
    });

    ipcMain.on("request-cover",function(event, data) {
        const path = data.path;

        libraryHandler.initialize().then(()=>{
            libraryHandler.requestCover(path)
                .then((base64)=>{
                    event.sender.send("request-cover",{base64:base64});
                })
        });
    });

    ipcMain.on("track-action",function(event,data) {
        const type = data.type;
        switch(type) {
            case "play": {
                window.setThumbarButtons([
                    {
                        tooltip: "Previous Track",
                        icon: path.join(__dirname,"../assets/icons/previous.png"),
                        click: function() {window.webContents.send("track-action",{type:"previous"})}
                    },
                    {
                        tooltip: "Pause",
                        icon: path.join(__dirname,"../assets/icons/pause.png"),
                        click: function() {window.webContents.send("track-action",{type:"pause"})}
                    },
                    {
                        tooltip: "Next Track",
                        icon: path.join(__dirname,"../assets/icons/skip.png"),
                        click: function() {window.webContents.send("track-action",{type:"skip"})}
                    }
                ])
            } break;
            case "pause": {
                window.setThumbarButtons([
                    {
                        tooltip: "Previous Track",
                        icon: path.join(__dirname,"../assets/icons/previous.png"),
                        click: function() {window.webContents.send("track-action",{type:"previous"})}
                    },
                    {
                        tooltip: "Pause",
                        icon: path.join(__dirname,"../assets/icons/play.png"),
                        click: function() {window.webContents.send("track-action",{type:"play"})}
                    },
                    {
                        tooltip: "Next Track",
                        icon: path.join(__dirname,"../assets/icons/skip.png"),
                        click: function() {window.webContents.send("track-action",{type:"skip"})}
                    }
                ])
            } break;
            case "next": tracklistHandler.getNextTrack(); break;
            case "previous": tracklistHandler.getPreviousTrack(); break;
        }
    });

    ipcMain.on("track-update",function(event, data) {
        var track = data.track;
        var position = data.position;
        tracklistHandler.saveLatestTrack(track.queue,track["source-identifier"],track.identifier,position);
    });
}

function playTrack(track, autoplay=true, position=0) {
    const id = track.identifier;
    const sid = track["source-identifier"];

    libraryHandler.initialize().then(()=>{
        libraryHandler.lookupTrack(sid,id).then((track)=>{

            const queueName = tracklistHandler.queueName;
            track.queue = queueName;
            track["source-identifier"] = sid;
            console.log(track);
            window.webContents.send("play-track",{track:track,autoplay:autoplay,position:position});
        }).catch(()=>{
        });
    });
}

module.exports = {
    createWindow : createWindow,
    getWindow : function() {
        return window;
    },
    playTrack: playTrack
};