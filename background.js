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

// Create user ID once on extension install
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

// Track active tab changes
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

// Track tab updates including URL changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.url) {
    chrome.storage.local.get([tabId.toString(), "userId"], (result) => {
      const previousVisit = result[tabId.toString()];
      const userId = result.userId;

      if (!userId) {
        console.warn("No userId found, skipping visit tracking.");
        return;
      }

      if (previousVisit) {
        if (isIgnoredUrl(previousVisit.url)) {
          chrome.storage.local.remove(tabId.toString());
        } else {
          const closeTime = new Date().toISOString();
          const timeSpent =
            new Date(closeTime).getTime() -
            new Date(previousVisit.openTime).getTime();

          const finalData = {
            userId,
            url: previousVisit.url,
            title: previousVisit.title,
            openTime: previousVisit.openTime,
            closeTime,
            timeSpent,
          };

          console.log("Sending previous visit data on URL change:", finalData);

          fetch("http://localhost:5001/api/visits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(finalData),
          })
            .then((res) => {
              if (res.ok) {
                console.log("Previous visit data sent successfully");
              } else {
                console.error("Failed to send previous visit:", res.statusText);
              }
            })
            .catch((err) => {
              console.error("Error sending previous visit:", err);
            });

          chrome.storage.local.remove(tabId.toString());
        }
      }

      if (isIgnoredUrl(tab.url)) {
        console.log("Ignoring URL on update:", tab.url);
        return;
      }

      const newVisitData = {
        userId,
        url: tab.url,
        title: tab.title,
        openTime: new Date().toISOString(),
        tabId,
      };

      chrome.storage.local.set({ [tabId.toString()]: newVisitData }, () => {
        console.log("Started new visit for URL change:", newVisitData);
      });
    });
    return;
  }

  if (changeInfo.status === "complete" && tab.active) {
    if (isIgnoredUrl(tab.url)) {
      console.log("Ignoring URL on load complete:", tab.url);
      return;
    }

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

      chrome.storage.local.set({ [tabId.toString()]: visitData }, () => {
        console.log("Visit data stored on load complete:", visitData);
      });
    });
  }
});

// Handle tab closed event — finalize visit data
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.get([tabId.toString(), "userId"], (result) => {
    const visit = result[tabId.toString()];
    const userId = result.userId;

    if (!visit || !userId || isIgnoredUrl(visit.url)) {
      console.warn("No valid visit to process for tab close:", tabId);
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

    console.log("Sending visit data on tab close:", finalData);

    fetch("http://localhost:5001/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finalData),
    })
      .then((res) => {
        if (res.ok) {
          console.log("Visit data sent successfully on tab close");
        } else {
          console.error("Failed to send visit on tab close:", res.statusText);
        }
      })
      .catch((err) => {
        console.error("Error sending visit on tab close:", err);
      });

    chrome.storage.local.remove(tabId.toString());
  });
});
