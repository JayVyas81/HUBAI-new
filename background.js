// background.js
// This is the final, definitive version of your extension's background script.

function generateUserId() {
  return "user-" + Math.random().toString(36).substring(2, 15);
}

function isIgnoredUrl(url) {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return (
      url.startsWith("chrome://") ||
      url.startsWith("about:") ||
      url.startsWith("file://") ||
      hostname === "localhost" ||
      hostname === "127.0.0.1"
    );
  } catch {
    return true;
  }
}

// --- Initial Setup ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get("userId", (data) => {
    if (!data.userId) {
      const newUserId = generateUserId();
      chrome.storage.local.set({ userId: newUserId });
    }
  });
  // This will now work correctly after reloading the extension with "idle" permission
  chrome.idle.setDetectionInterval(15);
});

// --- State Management ---
const visitData = {};
const tabTimers = {};

// --- Idle Time Tracking ---
chrome.idle.onStateChanged.addListener((newState) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const activeTabId = tabs[0].id;
      if (newState === "active") {
        resumeTimer(activeTabId);
      } else {
        pauseTimer(activeTabId);
      }
    }
  });
});

// --- Tab Event Listeners ---
chrome.tabs.onActivated.addListener((activeInfo) => {
  const tabId = activeInfo.tabId;
  for (const otherTabId in tabTimers) {
    if (parseInt(otherTabId) !== tabId) {
      pauseTimer(parseInt(otherTabId));
    }
  }
  resumeTimer(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.url) {
    if (visitData[tabId]) {
      sendVisitData(tabId, true);
    }
    if (!isIgnoredUrl(tab.url)) {
      startTracking(tabId, tab.url, tab.title);
    }
  }
  if (changeInfo.status === "complete" && visitData[tabId]) {
    visitData[tabId].title = tab.title;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (visitData[tabId]) {
    sendVisitData(tabId, true);
  }
});

// --- Helper Functions ---
function startTracking(tabId, url, title) {
  visitData[tabId] = { url, title, openTime: new Date().toISOString() };
  tabTimers[tabId] = { totalTimeSpent: 0, segmentStartTime: Date.now() };
}

function pauseTimer(tabId) {
  const timer = tabTimers[tabId];
  if (timer && timer.segmentStartTime) {
    const duration = Date.now() - timer.segmentStartTime;
    timer.totalTimeSpent += duration;
    timer.segmentStartTime = null;
  }
}

function resumeTimer(tabId) {
  const timer = tabTimers[tabId];
  if (timer && !timer.segmentStartTime) {
    timer.segmentStartTime = Date.now();
  }
}

async function sendVisitData(tabId, shouldCleanup) {
  pauseTimer(tabId);
  const visit = visitData[tabId];
  const timer = tabTimers[tabId];
  if (!visit || !timer) return;

  const { userId } = await chrome.storage.local.get("userId");
  if (!userId || isIgnoredUrl(visit.url)) {
    if (shouldCleanup) {
      delete visitData[tabId];
      delete tabTimers[tabId];
    }
    return;
  }

  const finalData = {
    userId,
    url: visit.url,
    title: visit.title,
    openTime: visit.openTime,
    closeTime: new Date().toISOString(),
    // FINAL FIX: Ensure timeSpent is sent as SECONDS
    timeSpent: Math.round(timer.totalTimeSpent / 1000),
  };

  fetch("http://localhost:5001/api/visits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(finalData),
  })
    .then((res) => {
      /* ... */
    })
    .catch((err) => console.error("[ERROR] Sending visit:", err));

  if (shouldCleanup) {
    delete visitData[tabId];
    delete tabTimers[tabId];
  }
}
