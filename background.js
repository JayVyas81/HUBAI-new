// --- Helper Functions & Initial Setup ---

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

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get("userId", (data) => {
    if (!data.userId) {
      const newUserId = generateUserId();
      chrome.storage.local.set({ userId: newUserId }, () => {
        console.log("Generated new user ID:", newUserId);
      });
    } else {
      console.log("Existing user ID:", data.userId);
    }
  });
});

// --- State Management for Timers and Visit Data ---

// Stores timers: { totalTimeSpent, segmentStartTime }
const tabTimers = {};
// Stores visit details: { url, title, openTime }
const visitData = {};

// --- Core Idle Time Tracking Logic ---

chrome.idle.setDetectionInterval(15);

chrome.idle.onStateChanged.addListener((newState) => {
  console.log(`Idle state changed to: ${newState}`);
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) return;
    const activeTabId = tabs[0].id;

    // Pause or resume the timer for the currently active tab
    if (newState !== "active") {
      pauseTimer(activeTabId);
    } else {
      resumeTimer(activeTabId);
    }
  });
});

// --- Timer Control Functions ---

function pauseTimer(tabId) {
  const timer = tabTimers[tabId];
  if (timer && timer.segmentStartTime) {
    const segmentDuration = Date.now() - timer.segmentStartTime;
    timer.totalTimeSpent += segmentDuration;
    timer.segmentStartTime = null; // Pause the timer
    console.log(
      `Tab ${tabId}: Paused. Added ${Math.round(segmentDuration / 1000)}s.`
    );
  }
}

function resumeTimer(tabId) {
  const timer = tabTimers[tabId];
  if (timer && !timer.segmentStartTime) {
    timer.segmentStartTime = Date.now(); // Resume the timer
    console.log(`Tab ${tabId}: Resumed.`);
  }
}

// --- Tab Event Listeners ---

// When a new tab becomes active
chrome.tabs.onActivated.addListener((activeInfo) => {
  const tabId = activeInfo.tabId;
  const now = Date.now();

  // Pause all other timers
  for (const otherTabId in tabTimers) {
    if (parseInt(otherTabId) !== tabId) {
      pauseTimer(parseInt(otherTabId));
    }
  }

  // If the activated tab has a timer, resume it
  if (tabTimers[tabId]) {
    resumeTimer(tabId);
  }
});

// When a tab's URL or status changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // A. A new URL is being navigated to in an active tab
  if (tab.active && changeInfo.url) {
    // If there was a previous visit in this tab, send its data
    if (visitData[tabId] && !isIgnoredUrl(visitData[tabId].url)) {
      sendVisitData(tabId, true); // Send and clean up previous visit
    }

    // Start tracking the new visit
    if (!isIgnoredUrl(tab.url)) {
      visitData[tabId] = {
        url: tab.url,
        title: tab.title,
        openTime: new Date().toISOString(),
      };
      tabTimers[tabId] = { totalTimeSpent: 0, segmentStartTime: Date.now() };
      console.log(`New visit started for tab ${tabId}: ${tab.url}`);
    }
  }

  // B. The page has finished loading
  if (changeInfo.status === "complete" && visitData[tabId]) {
    // Update the title with the final, correct title
    visitData[tabId].title = tab.title;
  }
});

// When a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (visitData[tabId]) {
    sendVisitData(tabId, true); // Send and clean up the final visit
  }
});

// --- Data Sending Function ---
async function sendVisitData(tabId, shouldCleanup) {
  pauseTimer(tabId); // Ensure the last segment is counted

  const visit = visitData[tabId];
  const timer = tabTimers[tabId];

  if (!visit || !timer) return;

  const { userId } = await chrome.storage.local.get("userId");
  if (!userId) {
    console.warn("Cannot send visit data: userId not found.");
    return;
  }

  const finalData = {
    userId,
    url: visit.url,
    title: visit.title,
    openTime: visit.openTime,
    closeTime: new Date().toISOString(),
    timeSpent: timer.totalTimeSpent / 1000, // Convert to seconds
  };

  console.log(`Sending data for tab ${tabId}:`, finalData);

  fetch("http://localhost:5001/api/visits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(finalData),
  })
    .then((res) => {
      if (res.ok) console.log("Visit data sent successfully.");
      else console.error("Failed to send visit data:", res.statusText);
    })
    .catch((err) => console.error("Error sending visit data:", err));

  if (shouldCleanup) {
    delete visitData[tabId];
    delete tabTimers[tabId];
  }
}
