const {app, BrowserWindow,ipcRenderer,ipcMain} = require("electron");
const path = require("path");
const fs = require("fs");
const userDataPath = (app || remote.app).getPath("userData");

const threads = require("threads");
const config = threads.config;
const spawn = threads.spawn;
const utils = require("./utilities");
const notificationHandler = require("./notificationHandler");
const mm = require('musicmetadata');
const mainWindow = require("../windows/main");

config.set({
    basepath: {
        node: __dirname
    }
});

var initialized = false;
var sources = {};

function initialize() {
    return new Promise(resolve => {
        const libraryHandler = require("./libraryHandler");
        if(libraryHandler.initialized) resolve();
        else {
            try { fs.mkdirSync(path.join(userDataPath,"song-library")); } catch(e) {}
            fs.readFile(path.join(userDataPath,"song-library/sources.json"),"utf8",function(error, data) {
                if(!error) {
                    try {
                        const json = JSON.parse(data);
                        json.forEach((source) => {
                            if( typeof source.directory !== "undefined" &&
                                typeof source.lastUpdate !== "undefined" &&
                                typeof source.fileCount !== "undefined" &&
                                typeof source.identifier !== "undefined")
                                libraryHandler.sources[source.identifier]=source;
                        });
                        console.log(libraryHandler.sources)
                    } catch(e) {
                        libraryHandler.initialized = true;
                        resolve();
                    }
                }

                libraryHandler.initialized = true;
                resolve();
            });
        }
    })
}

function getTracks(identifier) {
    console.log(identifier);
    const libraryHandler = require("./libraryHandler");
    return new Promise(resolve => {
        try {
            var trackedSources = [];
            if (typeof identifier === "undefined") Object.keys(libraryHandler.sources).forEach(function(sourceIdentifier) {
                trackedSources.push(sourceIdentifier)
            });
            else Object.keys(libraryHandler.sources).forEach(function (sourceIdentifier) {
                if (sourceIdentifier === identifier) trackedSources.push(sourceIdentifier);
            });

            loopTracks(trackedSources, function (tracks) {
                resolve(tracks);
            });
        }catch(e){console.log(e)}
    });
}

function loopTracks(sources, callback, output=[]) {
    if(sources.length===0)return callback(output);
    const source = sources[0];
    const sourcePath = path.join(userDataPath,"song-library/"+source);
    fs.readFile(path.join(sourcePath,"tracks.json"),"utf8",function(error, data) {
        if(!error) {
            try {
                const json = JSON.parse(data);
                json.forEach((item)=>{
                    item["source-identifier"] = source;
                });
                output = output.concat(json);
            } catch(e) {}
        }

        sources.splice(0,1);
        return loopTracks(sources,callback,output);
    });
}

function saveLibraries() {
    const libraryHandler = require("./libraryHandler");
    var toSave = [];
    Object.keys(libraryHandler.sources).forEach(function(identifier) {
        toSave.push(sources[identifier]);
    });

    try { fs.mkdirSync(path.join(userDataPath,"song-library")); } catch(e) {}
    fs.writeFileSync(path.join(userDataPath,"song-library/sources.json"),JSON.stringify(toSave));
}

function lookupTrack(sourceIdentifier, trackIdentifier) {
    return new Promise(resolve => {
        const libraryHandler = require("./libraryHandler");
        var identifierExists = false;
        Object.keys(libraryHandler.sources).forEach((source) => {
            if(source===sourceIdentifier) identifierExists = true;
        });

        if(identifierExists) {
            const sourcePath = path.join(userDataPath,"song-library/"+sourceIdentifier);
            fs.readFile(path.join(sourcePath,"tracks.json"),"utf8",function(error, data) {
                if(!error) {
                    try {
                        const json = JSON.parse(data);
                        var searchedTrack = undefined;
                        json.forEach((track)=>{
                            if(track.identifier === trackIdentifier) searchedTrack = track;
                        });

                        if(typeof searchedTrack === "undefined") throw "Unknown track";
                        else {
                            searchedTrack.path = searchedTrack.path.replace(/\\/g,"/");
                            resolve(searchedTrack);
                        }
                    } catch(e) {throw e;}
                }
            });
        } else
            throw "Unknown source";
    })
}

function addLibrary(directory, callback) {
    const identifier = generateIdentifier();
    const libraryHandler = require("./libraryHandler");
    libraryHandler.sources[identifier] = {
        identifier: identifier,
        directory: directory,
        lastUpdate: -1,
        fileCount: 0
    };
    saveLibraries();
    notificationHandler.emitNotification({
        id:"lib-"+identifier,
        type:"progress",
        data: {
            title: "Reading library "+directory,
            description: "Register Library",
            progress: 0
        }
    });
    try { fs.mkdirSync(path.join(userDataPath,"song-library/"+identifier)); } catch(e) {}

    if(typeof callback !== "undefined") readLibrary(directory,callback,identifier);
    else return identifier;

}

function generateIdentifier() {
    const identifier = utils.randomString(30);
    return typeof sources[identifier]==="undefined"?identifier:generateIdentifier();
}

function generateAlbumIdentifier(artist, album) {
    return Buffer.from(artist+"-"+album).toString("base64");
}

function requestCover(filePath) {
    return new Promise(resolve => {
        try {
            const stream = fs.createReadStream(filePath);
            mm(stream,{},function(error, metadata) {
                if(error) throw error;
                const picture = metadata.picture;
                if(typeof picture === "undefined" || picture.length===0) throw "No Cover found";
                const base64 = "data:image/jpeg;base64,"+picture[0].data.toString("base64");
                resolve(base64);
            });
        } catch(e) {
            throw e;
        }
    });
}

function addCover(coverLibrary, metaData, covers) {
    const albumIdentifier = generateAlbumIdentifier(metaData.artist,metaData.album);
    if(typeof covers[albumIdentifier] !== "undefined") {
        metaData.picture = covers[albumIdentifier];
    } else if(typeof metaData.picture !== "undefined") {
        try {
            const coverPath = path.join(coverLibrary, albumIdentifier+".jpg");
            fs.writeFileSync(coverPath, metaData.picture, "base64");
            covers[albumIdentifier] = ("file:///"+coverPath).replace(/\\/g,"/");
            metaData.picture = covers[albumIdentifier];
        } catch(e){
            delete metaData.picture;
        }
    } else {
        delete metaData.picture;
    }

    return {covers, metaData};
}

function getSongIdentifier(title, artist, album) {
    return Buffer.from(artist+"-"+album+"-"+title).toString("base64");
}

function readLibrary(directory, callback, identifier) {

    if(typeof identifier === "undefined")
        identifier = addLibrary(directory);

    const fileThread = spawn("directoryParser.js");
    const dataLibrary = path.join(userDataPath,"song-library/"+identifier);

    var count = 0;
    var read = 0;
    var start = Date.now();
    var tracks = [];

    const libraryHandler = require("./libraryHandler");

    //var covers = {};
    //const coverPath = path.join(dataLibrary,"cover");
    //try { fs.mkdirSync(coverPath); } catch(e) {}
    try {
        fs.writeFileSync(path.join(dataLibrary,"archive.json"),JSON.stringify({
            count: count,
            read: read,
            start: start
        }));
    } catch(e){}

    notificationHandler.emitNotification({
        id:"lib-"+identifier,
        type:"progress",
        data: {
            title: "Reading library",
            description: "Counting files",
            progress: 0
        }
    });

    mainWindow.getWindow().setProgressBar(1,{mode:"indeterminate"});

    fileThread
     .send({directory:directory})
     .on("done",function(result) {
        if(result.type==="count") {
            count = result.count;
            callback("count",count);
            libraryHandler.sources[identifier] = {
                identifier: identifier,
                directory: directory,
                lastUpdate: -1,
                fileCount: count
            };
            saveLibraries();
        }

        if(result.type==="track") {
            read++;
            //addCover(coverPath,result.meta,covers);
            callback("track",{
                meta:result.meta,
                read: read,
                percentage: (Math.round((100/count)*read))
            });

            mainWindow.getWindow().setProgressBar((1/count)*read);

            const song = result.meta;
            song["identifier"] = getSongIdentifier(song.title,song.artist,song.album);

            tracks.push(song);
            try { fs.writeFileSync(path.join(dataLibrary,"tracks.json"),JSON.stringify(tracks)) } catch(e) {}

            try {
                fs.writeFileSync(path.join(dataLibrary,"archive.json"),JSON.stringify({
                    count: count,
                    read: read,
                    start: start
                }));
            } catch(e){}

            notificationHandler.emitNotification({
                id:"lib-"+identifier,
                type:"progress",
                data: {
                    title: "Reading library ("+read+"/"+count+")",
                    description: "Added file "+song.title,
                    progress: (Math.round((100/count)*read))
                }
            });
        }
        if(result.type==="done") {

            mainWindow.getWindow().setProgressBar(0);

            notificationHandler.emitNotification({
                id:"lib-"+identifier,
                type:"progress",
                data: {
                    title: "Reading library ("+read+"/"+read+")",
                    description: "Finished Reading archive",
                    progress: 100
                }
            });

            libraryHandler.sources[identifier] = {
                identifier: identifier,
                directory: directory,
                lastUpdate: Date.now(),
                fileCount: read
            };

            try {
                fs.writeFileSync(path.join(dataLibrary,"archive.json"),JSON.stringify({
                    count: count,
                    read: read,
                    start: start
                }));
            } catch(e){}

            saveLibraries();
            callback("done",{read:read,identifier:identifier,time:Math.round((Date.now()-start)/1000)});
        }
    });
}

module.exports = {
    initialize: initialize,
    initialized: initialized,
    sources: sources,
    addLibrary: addLibrary,
    readLibrary: readLibrary,
    getTracks: getTracks,
    lookupTrack: lookupTrack,
    requestCover: requestCover
};