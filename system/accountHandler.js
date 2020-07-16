const {app, BrowserWindow,ipcRenderer,ipcMain} = require("electron");
const path = require("path");
const fs = require("fs");
const userDataPath = (app || remote.app).getPath("userData");

var initialized = false;

var loggedIn = false;
var isGuest = false;
var userid = -1;
var username = "Guest";
var email = "Not logged in";

function initialize() {
    return new Promise(resolve => {
        const accountHandler = require("./accountHandler");
        if(accountHandler.initialized) resolve();
        else {
            fs.readFile(path.join(userDataPath,"account.json"),"utf8",function(error, data) {
                if(!error) {
                    try {
                        const json = JSON.parse(data);

                        if(typeof json.isGuest !== "undefined" && json.isGuest) {
                            accountHandler.loggedIn = true;
                            accountHandler.isGuest = true;
                        } else if(typeof json.userid !== "undefined" && typeof json.username !== "undefined" && typeof json.email !== "undefined") {
                            accountHandler.loggedIn = true;
                            accountHandler.isGuest = false;
                            accountHandler.userid = json.userid;
                            accountHandler.username = json.username;
                            accountHandler.email = json.email;
                        }
                    } catch(e) {
                        accountHandler.initialized = true;
                        resolve();
                    }
                }

                accountHandler.initialized = true;
                resolve();
            });
        }
    })
}

function performLogin(data) {
    const accountHandler = require("./accountHandler");
    if(data.type==="guest") {
        accountHandler.loggedIn = true;
        accountHandler.isGuest = true;
        accountHandler.userid = -1;
        accountHandler.username = "Guest";
        accountHandler.email = "Not logged in";

        fs.writeFileSync(path.join(userDataPath,"account.json"),JSON.stringify({
            isGuest: true
        }));
    }
}

function logout() {
    const accountHandler = require("./accountHandler");
    fs.unlinkSync(path.join(userDataPath,"account.json"));
    accountHandler.loggedIn = false;
    accountHandler.isGuest = true;
    accountHandler.userid = -1;
    accountHandler.username = "Guest";
    accountHandler.email = "Not logged in";
}

function packUserData() {
    const accountHandler = require("./accountHandler");
    return {
        isGuest: accountHandler.isGuest,
        userid: accountHandler.userid,
        username: accountHandler.username,
        email: accountHandler.email
    }
}

module.exports = {
    initialize: initialize,
    performLogin: performLogin,
    initialized: initialized,
    loggedIn: loggedIn,
    isGuest: isGuest,
    userid: userid,
    username: username,
    email: email,
    packUserData: packUserData,
    logout: logout
};