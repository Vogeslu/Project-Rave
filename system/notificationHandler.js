const notificationListeners = [];

function listenToNotifications(callback) {
    notificationListeners.push(callback);
}

function emitNotification(notification) {
    notificationListeners.forEach((listener)=>{
        listener(notification);
    })
}

module.exports = {
    listenToNotifications: listenToNotifications,
    emitNotification: emitNotification
};