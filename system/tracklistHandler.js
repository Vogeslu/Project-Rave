var queueName = "";
var queue = [];
var queuePosition = 0;

var shuffleEnabled = false;
var repeatType = false;

const {app, BrowserWindow,ipcRenderer,ipcMain} = require("electron");
const path = require("path");
const fs = require("fs");
const userDataPath = (app || remote.app).getPath("userData");

var initialized = false;

const mainWindow = require("../windows/main");
const libraryHandler = require("./libraryHandler");


function initialize() {
    return new Promise(resolve => {
        if(initialized) resolve();
        else {
            fs.readFile(path.join(userDataPath,"track-data.json"),"utf8",function(error, data) {
                if(!error) {
                    try {
                        const json = JSON.parse(data);
                        if(typeof json.latestTrack !== "undefined") {
                            const queue = json.latestTrack.queue.length===0?"all":json.latestTrack.queue;
                            const sid = json.latestTrack.sid;
                            const id = json.latestTrack.id;
                            const duration = json.latestTrack.duration;

                            startQueueFromTag(queue,sid,id,false,duration);
                        }
                    } catch(e) {
                        initialized = true;
                        resolve();
                    }
                }

                initialized = true;
                resolve();
            });
        }
    })
}

function saveLatestTrack(queue, sid, id, duration) {
    fs.writeFileSync(path.join(userDataPath,"track-data.json"),JSON.stringify({
        latestTrack: {
            queue: queue,
            sid: sid,
            id: id,
            duration: duration
        }
    }));
}

function startQueueFromTag(queue, sid, id, autoplay=true, position=0) {
    queueName = queue;
    libraryHandler.getTracks(queue==="all"?undefined:queue)
        .then((tracks)=>{
            var startIndex = 0;
            for(var i = 0; i < tracks.length; i++) {
                const track = tracks[i];
                if(track.identifier===id && track["source-identifier"]===sid) startIndex=i;
                track.queue = queue;
            }

            startQueue(tracks,startIndex,autoplay,position);
        });
}

function startQueue(tracklist, startIndex=0, autoplay=true, position=0) {

    return new Promise(resolve => {
        if(tracklist.length===0) throw "Tracklist is empty";
        if(startIndex>=tracklist.length) startIndex = 0;

        queue = tracklist;
        queuePosition = startIndex;

        const track = tracklist[startIndex];

        saveLatestTrack(queueName,track["source-identifier"],track.identifier,position);
        mainWindow.playTrack(track,autoplay,position);

        resolve();
    })
}

function getNextTrack() {
    return new Promise(resolve => {
        if(queue.length===0) throw "Tracklist is empty";
        queuePosition++;
        if(queuePosition>=queue.length) queuePosition = 0;

        const track = queue[queuePosition];

        saveLatestTrack(queueName,track["source-identifier"],track.identifier,0);
        mainWindow.playTrack(track);

        resolve();
    });
}

function getPreviousTrack() {
    return new Promise(resolve => {
        if(queue.length===0) throw "Tracklist is empty";
        queuePosition--;
        if(queuePosition<0) queuePosition = queue.length-1;

        mainWindow.playTrack(queue[queuePosition]);

        const track = queue[queuePosition];

        saveLatestTrack(queueName,track["source-identifier"],track.identifier,0);
        mainWindow.playTrack(track);

        resolve();
    });
}

module.exports = {
    queueName: queueName,
    startQueue: startQueue,
    startQueueFromTag: startQueueFromTag,
    getNextTrack: getNextTrack,
    getPreviousTrack: getPreviousTrack,
    initialize: initialize,
    saveLatestTrack: saveLatestTrack
};