// content.js

function sendActivity(activity) {
  chrome.runtime.sendMessage({ type: "activity", data: activity });
}

// Track clicks
document.addEventListener("click", (e) => {
  sendActivity({
    type: "click",
    tag: e.target.tagName,
    text: e.target.innerText || "",
    timestamp: new Date().toISOString(),
  });
});

// Track scroll percentage (throttle to avoid spamming)
let lastScrollPercent = 0;
window.addEventListener("scroll", () => {
  const scrollPercent = Math.round(
    (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
  );
  // Only send if scrollPercent changed by 5% or more
  if (Math.abs(scrollPercent - lastScrollPercent) >= 5) {
    lastScrollPercent = scrollPercent;
    sendActivity({
      type: "scroll",
      scrollPercent,
      timestamp: new Date().toISOString(),
    });
  }
});
