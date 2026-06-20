chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

function broadcast(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Auto-detected number from content script
  if (message.type === "NEW_NUMBER") {
    chrome.storage.local.get(["numbers", "currentDealer"], (result) => {
      const numbers = result.numbers || [];
      numbers.push({ n: message.number, t: Date.now(), dealer: result.currentDealer || null });
      chrome.storage.local.set({ numbers }, () => {
        broadcast({ type: "UPDATE_STATS", numbers });
      });
    });
  }

  // Sidebar manually syncing its state (after manual input or dealer changes)
  if (message.type === "SYNC_NUMBERS") {
    broadcast({ type: "UPDATE_STATS", numbers: message.numbers });
  }

  if (message.type === "CLEAR_DATA") {
    chrome.storage.local.set({ numbers: [] }, () => {
      broadcast({ type: "UPDATE_STATS", numbers: [] });
    });
  }

  if (message.type === "GET_STATS") {
    chrome.storage.local.get(["numbers"], (result) => {
      sendResponse({ numbers: result.numbers || [] });
    });
    return true;
  }
});
