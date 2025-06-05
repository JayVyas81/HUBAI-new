// background.js

// Generate or get userId once on extension install
function generateUserId() {
  return "user-" + Math.random().toString(36).substring(2, 15);
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

let activeTabId = null;
let activeTabUrl = null;

// Handle tab switch
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    activeTabId = tab.id;
    activeTabUrl = tab.url;
    console.log(`Switched to tab: ${tab.url}`);
  } catch (error) {
    console.error("Error getting active tab:", error);
  }
});
// Handle tab URL updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === activeTabId && changeInfo.url) {
    console.log(`Active tab URL changed: ${changeInfo.url}`);
    activeTabUrl = changeInfo.url;
  }

  if (changeInfo.status === "complete" && tab.active) {
    chrome.storage.local.get("userId", ({ userId }) => {
      if (!userId) {
        console.warn("No userId found, skipping visit storage.");
        return;
      }

      const visitData = {
        userId,
        url: tab.url,
        title: tab.title,
        openTime: new Date().toISOString(),
        tabId: tabId,
      };

      console.log("Storing visit data for tab:", tabId, visitData);
      chrome.storage.local.set({ [tabId.toString()]: visitData }, () => {
        if (chrome.runtime.lastError) {
          console.error("Storage set error:", chrome.runtime.lastError);
        } else {
          console.log("Visit data stored successfully:", visitData);
        }
      });
    });
  }
});

// Handle tab closed
chrome.tabs.onRemoved.addListener((tabId) => {
  console.log("Tab closed:", tabId);

  chrome.storage.local.get([tabId.toString(), "userId"], (result) => {
    const visit = result[tabId.toString()];
    const userId = result.userId;

    if (!visit || !userId) {
      console.warn("Visit data or userId missing for tab:", tabId);
      return;
    }

    const closeTime = new Date().toISOString();
    const timeSpent =
      new Date(closeTime).getTime() - new Date(visit.openTime).getTime();

    const finalData = {
      userId,
      url: visit.url,
      title: visit.title,
      openTime: visit.openTime,
      closeTime,
      timeSpent,
    };

    console.log("Sending visit data to backend:", finalData);

    fetch("http://localhost:5001/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finalData),
    })
      .then((response) => {
        if (response.ok) {
          console.log("Data sent successfully:", response.status);
        } else {
          console.error("Failed to send data:", response.statusText);
        }
      })
      .catch((err) => {
        console.error("Network or backend error:", err);
      });

    chrome.storage.local.remove(tabId.toString());
  });
});

// Listen for messages from content.js (user activity events)
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "activity") {
    chrome.storage.local.get("userId", ({ userId }) => {
      const activityData = {
        userId: userId || "unknown",
        url: sender.tab ? sender.tab.url : "",
        ...message.data,
      };
      console.log("Sending in-page activity to backend:", activityData);
      fetch("http://localhost:5001/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activityData),
      }).catch((err) => {
        console.error("Error sending activity data:", err);
      });
    });
  }
});
