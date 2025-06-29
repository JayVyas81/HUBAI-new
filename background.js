// background.js
// This final version includes robust idle tracking and smarter navigation logic
// to correctly track visits when moving from one site to another.

// --- Helper Functions ---
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

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
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
  chrome.idle.setDetectionInterval(15);
});

// --- State Management ---
const visitData = {}; // Stores { url, title, openTime }
const tabTimers = {}; // Stores { totalTimeSpent_ms, segmentStartTime }

// --- Idle Time Tracking ---
chrome.idle.onStateChanged.addListener((newState) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const activeTabId = tabs[0].id;
      newState === "active"
        ? resumeTimer(activeTabId)
        : pauseTimer(activeTabId);
    }
  });
});

// --- Tab Event Listeners ---
chrome.tabs.onActivated.addListener((activeInfo) => {
  const tabId = activeInfo.tabId;
  // Pause all other timers
  for (const otherTabId in tabTimers) {
    if (parseInt(otherTabId) !== tabId) {
      pauseTimer(parseInt(otherTabId));
    }
  }
  // Resume timer for the newly activated tab
  resumeTimer(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // We only care about URL changes in the active tab
  if (tab.active && changeInfo.url) {
    handleNavigation(tabId, changeInfo.url, tab.title);
  }

  // Update title when page finishes loading
  if (changeInfo.status === "complete" && visitData[tabId]) {
    visitData[tabId].title = tab.title;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (visitData[tabId]) {
    sendVisitData(tabId);
    cleanupVisit(tabId);
  }
});

// --- Core Logic Functions ---
function handleNavigation(tabId, newUrl, newTitle) {
  if (isIgnoredUrl(newUrl)) {
    // If we are navigating to an ignored URL, end the previous session if one exists
    if (visitData[tabId]) {
      sendVisitData(tabId);
      cleanupVisit(tabId);
    }
    return;
  }

  const currentVisit = visitData[tabId];
  const newDomain = getDomain(newUrl);

  // If there's no current visit, or the domain has changed, it's a new session
  if (!currentVisit || getDomain(currentVisit.url) !== newDomain) {
    // Send data for the previous visit if it exists
    if (currentVisit) {
      sendVisitData(tabId);
    }
    // Start tracking the new visit
    startTracking(tabId, newUrl, newTitle);
  } else {
    // If it's the same domain, just update the URL
    currentVisit.url = newUrl;
  }
}

function startTracking(tabId, url, title) {
  visitData[tabId] = { url, title, openTime: new Date().toISOString() };
  tabTimers[tabId] = { totalTimeSpent_ms: 0, segmentStartTime: Date.now() };
  console.log(`[START] Tracking new visit for tab ${tabId}: ${url}`);
}

function pauseTimer(tabId) {
  const timer = tabTimers[tabId];
  if (timer && timer.segmentStartTime) {
    const duration = Date.now() - timer.segmentStartTime;
    timer.totalTimeSpent_ms += duration;
    timer.segmentStartTime = null; // Pause
  }
}

function resumeTimer(tabId) {
  const timer = tabTimers[tabId];
  if (timer && !timer.segmentStartTime) {
    timer.segmentStartTime = Date.now(); // Resume
  }
}

async function sendVisitData(tabId) {
  pauseTimer(tabId);

  const visit = visitData[tabId];
  const timer = tabTimers[tabId];
  if (!visit || !timer || timer.totalTimeSpent_ms < 1000) {
    // Don't save visits less than 1 second
    return;
  }

  const { userId } = await chrome.storage.local.get("userId");
  if (!userId) return;

  const finalData = {
    userId,
    url: visit.url,
    title: visit.title || visit.url,
    openTime: visit.openTime,
    closeTime: new Date().toISOString(),
    // Send time in SECONDS
    timeSpent: Math.round(timer.totalTimeSpent_ms / 1000),
  };

  console.log(`[SEND] Finalizing visit for tab ${tabId}:`, finalData);
  fetch("http://localhost:5001/api/visits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(finalData),
  }).catch((err) => console.error("[ERROR] Could not send visit data:", err));
}

function cleanupVisit(tabId) {
  delete visitData[tabId];
  delete tabTimers[tabId];
}
