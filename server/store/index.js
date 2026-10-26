const users = new Map();
const offlineMessages = new Map();
const pushSubscriptions = new Map();
const lastSeen = new Map();

const groups = new Map();
const groupMessages = new Map();
const groupOfflineMessages = new Map();

module.exports = {
  users,
  offlineMessages,
  pushSubscriptions,
  lastSeen,
  groups,
  groupMessages,
  groupOfflineMessages
};
