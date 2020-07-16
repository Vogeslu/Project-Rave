
const mm = require('musicmetadata');
const fs = require("fs");
const mime = require("mime-types");

function countFiles(directory) {
    return new Promise(resolve => {
        fs.readdir(directory,function(error, files) {
            if(error) throw "Failed while reading source directory";
            countFilesInside(directory,files,function(error, fileCount) {
                if(error) throw "Failed while reading other directories";
                resolve(fileCount);
            },0);
        });
    });
}

function countFilesInside(path, directory, callback, output=0) {
    if(directory.length===0) return callback(false,output);
    var file = directory[0];
    fs.stat(path+"/"+file,function(error, stats) {
        if(error) return callback(true,"Stats");
        if(stats.isDirectory())
            fs.readdir(path+"/"+file,function(error, files) {
                if(error) return callback(true,"Files");
                countFilesInside(path+"/"+file,files,function(error, fileCount) {
                    if(error) return callback(true,"Read");
                    output+=fileCount;
                    directory.splice(0,1);
                    return countFilesInside(path,directory,callback,output);
                });
            });
        else {
            if(stats.isFile() && passAudioFile(path+"/"+file)) {
                try {
                    output++;
                    directory.splice(0, 1);
                    return countFilesInside(path, directory, callback, output);
                } catch(e) {
                    directory.splice(0, 1);
                    return countFilesInside(path, directory, callback, output);
                }
            } else {
                directory.splice(0,1);
                return countFilesInside(path,directory,callback,output);
            }
        }
    });
}

function readDirectory(directory,done) {
    return new Promise(resolve => {
        fs.readdir(directory,function(error, files) {
            if(error) throw "Failed while reading source directory";
            readDirectoryInside(directory,files,function(error, files) {
                if(error) throw "Failed while reading other directories";
                resolve(files);
            },[],done);
        });
    });
}

function readDirectoryInside(path, directory, callback, output=[],done) {
    if(directory.length===0) return callback(false,output);
    var file = directory[0];
    fs.stat(path+"/"+file,function(error, stats) {
        if(error) return callback(true,"Stats");
        if(stats.isDirectory())
            fs.readdir(path+"/"+file,function(error, files) {
                if(error) return callback(true,"Files");
                readDirectoryInside(path+"/"+file,files,function(error, files) {
                    if(error) return callback(true,"Read");
                    output = output.concat(files);
                    directory.splice(0,1);
                    return readDirectoryInside(path,directory,callback,output,done);
                },[],done);
            });
        else {
            if(stats.isFile() && passAudioFile(path+"/"+file)) {
                try {
                    var stream = fs.createReadStream(path+"/"+file);
                    mm(stream,{ duration: true },function(error, metadata) {

                        if(!error) {
                            var data = {
                                path: path+"/"+file,
                                title: metadata.title,
                                artist: metadata.artist,
                                album: metadata.album,
                                bpm: metadata.bpm,
                                //picture: metadata.picture,
                                year: metadata.year,
                                genre: metadata.genre,
                                duration: metadata.duration
                            };
                            /**if(typeof metadata.picture !== "undefined" && metadata.picture.length>0) {
                                var imageData = metadata.picture[0].data;
                                data.picture = imageData.toString("base64");
                            } else
                                delete data.picture;*/
                            output.push(data);

                            done({error:false,type:"track",meta:data});
                        }
                        directory.splice(0, 1);
                        return readDirectoryInside(path, directory, callback, output,done);
                    });
                } catch(e) {
                    directory.splice(0, 1);
                    return readDirectoryInside(path, directory, callback, output,done);
                }
            } else {
                directory.splice(0,1);
                return readDirectoryInside(path,directory,callback,output,done);
            }
        }
    });
}

function passAudioFile(file) {
    var mimeType = mime.lookup(file);
    return (mimeType==="audio/mpeg" || mimeType==="audio/wav")?mimeType:false
}

module.exports = function(input, done) {
    countFiles(input.directory)
        .then(function(count) {
            done({error:false,type:"count",count:count});
            readDirectory(input.directory, done)
                .then(function(files) {
                    done({error:false,type:"done",files:files});
                }).catch(function() {
                done({error:true});
            })
        }).catch(function() {
        done({error:true});
    });
};