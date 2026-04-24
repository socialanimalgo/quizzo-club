const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(100);

function publishNotification(userId, notification) {
  bus.emit(`notifications:${userId}`, notification);
}

function subscribeNotifications(userId, listener) {
  const event = `notifications:${userId}`;
  bus.on(event, listener);
  return () => bus.off(event, listener);
}

function publishKvizopoli(matchId, payload) {
  bus.emit(`kvizopoli:${matchId}`, payload);
}

function subscribeKvizopoli(matchId, listener) {
  const event = `kvizopoli:${matchId}`;
  bus.on(event, listener);
  return () => bus.off(event, listener);
}

module.exports = {
  publishNotification,
  subscribeNotifications,
  publishKvizopoli,
  subscribeKvizopoli,
};
