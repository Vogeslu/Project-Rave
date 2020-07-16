$(document).ready(function() {
    const player = document.createElement("audio");

    var currentTrack = {};
    var latestTrackUpdate = -1;

    const skipAnimations = false;
    const skipLogin = false;
    const showDeveloperTools = false;

    var volume = 1;

    var userData = {};
    var lastRequest = -1;
    const mediaField = $("#main-screen .media-field");

    const {remote, ipcRenderer} = require('electron');
    ipcRenderer.on("login-response", function (event, data) {
        if (data.loggedIn) {
            ipcRenderer.send("request-track", {});
            $("#start-screen").addClass("ignore");
            $("#start-screen").addClass("expand");
            redirectMainframe();

            userData = data.userData;
            fillUserData();
        } else 
            setTimeout(start,4000);
    });


    ipcRenderer.on("account-update", function (event, data) {
        userData = data;
        fillUserData();
    });

    function fillUserData() {
        $("#main-screen .sidebar-overlay .sidebar .profile-picture").css("background-image", (typeof userData.profilePicture !== "undefined" && userData.profilePicture.length > 0) ? "url(" + userData.profilePicture + ")" : "");
        $("#main-screen .sidebar-overlay .sidebar .name").html((typeof userData.username !== "undefined" && userData.username.length > 0) ? userData.username : "Guest");
        $("#main-screen .sidebar-overlay .sidebar .email").html((typeof userData.email !== "undefined" && userData.email.length > 0) ? userData.email : "Not logged in");
        $("#main-screen .top-field .user-field .user-profile").css("background-image", (typeof userData.profilePicture !== "undefined" && userData.profilePicture.length > 0) ? "url(" + userData.profilePicture + ")" : "");
    }

    ipcRenderer.send("request-login", {});

    $(".item.minimize").on("click", function (e) {
        var window = remote.getCurrentWindow();
        window.minimize();
    });

    $(".item.resize").on("click", function (e) {
        var window = remote.getCurrentWindow();
        if (window.isMaximized())
            window.unmaximize();
        else
            window.maximize();
    });

    $(".item.close").on("click", function (e) {
        var window = remote.getCurrentWindow();
        window.close();
    });

    function start() {
        setTimeout(function () {
            $("#start-screen").addClass("expand")
        }, skipAnimations ? 0 : 500);
        setTimeout(function () {
            $("#login-screen").addClass("visible");
            $("#start-screen").addClass("hide")
        }, skipAnimations ? 0 : 2500);
        setTimeout(function () {
            $("#login-screen .login-sidebar").addClass("visible")
        }, skipAnimations ? 0 : 3000);
    }

    /**if(!skipLogin) start();
     else {
            $("#start-screen").addClass("ignore");
            $("#start-screen").addClass("expand");
            redirectMainframe();
        }*/

    $("#login-screen .no-account").on("click", function () {
        $("#login-screen .login-sidebar").addClass("signup");
    });
    $("#login-screen .have-account").on("click", function () {
        $("#login-screen .login-sidebar").removeClass("signup");
    });

    $("#login-screen .skip-login").on("click", function () {
        ipcRenderer.send("login", {type: "guest"});
        redirectMainframe();
    });

    function redirectMainframe() {
        $("#login-screen").addClass("expand");
        setTimeout(function () {
            $("#main-screen").addClass("visible")
        }, 1000);
        $("#main-screen .navigation .item").removeClass("selected");
        var firstItem = $("#main-screen .navigation .item").first();
        firstItem.addClass("selected");
        $("#main-screen .top-bar").css("transform", "translateX(" + (firstItem.data("index")) + "px)");
        loadContent(firstItem.data("target"));
    }

    $("#main-screen .navigation .item").on("click", function () {
        var index = $(this).data("index");
        $("#main-screen .navigation .item").removeClass("selected");
        $("#main-screen .top-bar").css("transform", "translateX(" + index + "px)");
        $(this).addClass("selected");
        loadContent($(this).data("target"));
    });

    function loadContent(page) {
        $("#main-screen .content").html($("#main-screen .spinner-frame").html());
        lastRequest = Date.now();
        ipcRenderer.send("load-content", {page: page, timestamp: lastRequest});
    }

    ipcRenderer.on("content-received", function (event, data) {
        if (data.pass && data.lastRequest === lastRequest)
            $("#main-screen .content").load(data.path);
    });

    ipcRenderer.on("new-notification", function (event, data) {
        const notification = data.notification;
        const id = notification.id;

        var created = false;
        var notificationData = "";
        switch (notification.type) {
            case "progress": {
                notificationData = "<div class='progress'><div class='title'>" + notification.data.title + "</div><div class='description'><span class='inner'>" + notification.data.description + "</span><span class='percentage'>" + notification.data.progress + "%</span> </div><div class='progress-bar'><div class='progress-bar-inner' style='width: " + notification.data.progress + "%'></div></div></div>"
            }
        }

        $(".notification-list .no-notifications").remove();
        $(".notification-list .notification").each(function () {
            const identifier = $(this).data("id");
            if (identifier === id) {
                created = true;
                $(this).parent().prepend(this);
                $(this).html(notificationData);
            }
        });

        if (!created) {
            $(".notification-list").prepend("<div class='notification' data-id='" + id + "'>" + notificationData + "</div>");
        }
    });

    function logout() {
        ipcRenderer.send("logout", {});
        $("#start-screen").removeClass("ignore");
        $("#start-screen").removeClass("expand");
        $("#start-screen").removeClass("hide");
        $("#start-screen").addClass("reset");

        $("#main-screen .sidebar-overlay").removeClass("show");
        $("#main-screen .sidebar-overlay .item").removeClass("visible");
        $("#main-screen").removeClass("visible");
        $("#login-screen").addClass("reset");
        $("#login-screen .login-sidebar").removeClass("visible");
        $("#login-screen .login-sidebar").removeClass("signup");
        $("#login-screen").removeClass("visible");
        $("#login-screen").removeClass("expand");
        setTimeout(function () {
            $("#login-screen").removeClass("reset");
            $("#start-screen").removeClass("reset");
            start();
        }, 1000);
    }

    $("#main-screen .user-field .menu").on("click", function () {
        $("#main-screen .sidebar-overlay > .item").removeClass("visible");
        $("#main-screen .sidebar-overlay").addClass("show");
        $("#main-screen .sidebar-overlay .sidebar").addClass("visible");
    });

    mediaField.find(".song-cover").on("click", function () {
        $("#main-screen .sidebar-overlay > .item").removeClass("visible");
        $("#main-screen .sidebar-overlay").addClass("show");
        $("#main-screen .sidebar-overlay .big-cover").addClass("visible");
        var image = $(this).css("background-image");
        $("#main-screen .sidebar-overlay .big-cover .inner").css("background-image", image);
        $("#main-screen .sidebar-overlay .big-cover .background").css("background-image", image);
    });

    $("#main-screen .user-field .notifications").on("click", function () {
        if ($(this).hasClass("opened")) $(this).removeClass("opened");
        else $(this).addClass("opened");
    }).find(".notification-menu").click(function () {
        return false;
    });

    $("#main-screen .sidebar-overlay").on("click", function () {
        $(this).removeClass("show");
        $(".item").removeClass("visible");
    }).find(".no-clear").click(function () {
        return false;
    });

    if(showDeveloperTools) remote.getCurrentWindow().toggleDevTools();

    ipcRenderer.on("play-track", function (event, data) {
        const track = data.track;
        const autoplay = data.autoplay;
        const position = data.position;

        $("#main-screen .song-panel").removeClass("hidden");

        currentTrack = track;

        var artists = "";
        track.artist.forEach((artist) => {
            artists += artist + ", "
        });
        if (track.artist.length === 0) artists = "Unknown Artist";
        else artists = artists.substring(0, artists.length - 2);

        $(".song-name").html(track.title);
        $(".song-interpret").html(artists);

        document.title = track.title + " - " + track.artist;

        mediaField.find(".seek-bar-field .song-position").html("0:00");
        mediaField.find(".seek-bar-field .seek-bar-position").css("width", "0");

        ipcRenderer.send("request-cover", {path: track.path});

        player.setAttribute("src", track.path);
        player.currentTime = position;
        if (autoplay) player.play();
    });

    player.addEventListener("canplay", function () {
        const duration = Math.round(player.duration);
        const minutes = Math.floor(duration / 60);
        const seconds = duration - minutes * 60;

        mediaField.find(".seek-bar-field .song-length").html(str_pad_left(minutes, '0', 1) + ':' + str_pad_left(seconds, '0', 2));
    });

    player.addEventListener("timeupdate", function () {
        const duration = Math.round(player.currentTime);
        const minutes = Math.floor(duration / 60);
        const seconds = duration - minutes * 60;

        const percentage = (100 / player.duration) * player.currentTime;
        $(".song-progress-bar").css("width", percentage + "%");
        $("#main-screen .song-panel .seek-bar-position").css("width", percentage + "%");
        $("#main-screen .media-field .seek-bar").slider("value", percentage * 10);
        mediaField.find(".seek-bar-field .song-position").html(str_pad_left(minutes, '0', 2) + ':' + str_pad_left(seconds, '0', 2));

        if (lastRequest + 5000 < Date.now()) {
            ipcRenderer.send("track-update", {track: currentTrack, position: duration});
            lastRequest = Date.now();
        }

    });

    player.addEventListener("play", function () {
        $(".song-play .material-icons").html("pause");
        ipcRenderer.send("track-action", {type: "play"});
    });

    player.addEventListener("pause", function () {
        $(".song-play .material-icons").html("play_arrow");
        ipcRenderer.send("track-action", {type: "pause"});
    });

    player.addEventListener("ended", function () {
        ipcRenderer.send("track-action", {type: "next"});
    });

    $(".song-play").on("click", function () {
        if (!player.paused) player.pause(); else player.play();
    });

    $(".song-next").on("click", function () {
        ipcRenderer.send("track-action", {type: "next"});
    });

    $(".song-previous").on("click", function () {
        ipcRenderer.send("track-action", {type: "previous"});
    });

    function str_pad_left(string, pad, length) {
        return (new Array(length + 1).join(pad) + string).slice(-length);
    }

    ipcRenderer.on("request-cover", function (event, data) {
        const base64 = data.base64;
        const mediaField = $("#main-screen .media-field");
        mediaField.find(".song-cover").css("background-image", "url(" + base64 + ")");
    });

    ipcRenderer.on("track-action", function (event, data) {
        const type = data.type;
        switch (type) {
            case "play":
                player.play();
                break;
            case "pause":
                player.pause();
                break;
            case "skip":
                ipcRenderer.send("track-action", {type: "next"});
                break;
            case "previous":
                ipcRenderer.send("track-action", {type: "previous"});
                break;
        }
    });

    $(".logout").on("click", logout);

    $("#main-screen .media-field .seek-bar").slider({
        min: 1,
        max: 1000,
        slide: function (e, ui) {
            $(this).parent().find(".seek-bar-position").css("width", (ui.value / 10) + "%");
        },
        stop: function (e, ui) {
            player.pause();
            setTimeout(function () {
                const position = (player.duration / 1000) * ui.value;
                player.currentTime = position;
                player.play();
            }, 1);
        }
    });

    $("#main-screen .media-field .volume-slider-position").css("height", (100*player.volume)+"%");
    $("#main-screen .media-field .volume-slider").slider({
        orientation: "vertical",
        min: 0,
        max: 100,
        value: player.volume*100,
        slide: function (e, ui) {
            volume = ui.value/100;
            player.volume = volume;
            $(this).parent().find(".volume-slider-position").css("height", (100*volume) + "%");
        }
    });
});