// content.js

// Send activity data to background.js
function sendActivity(activity) {
  chrome.runtime.sendMessage({ type: "activity", data: activity });
}

// Track user clicks on the page
document.addEventListener("click", (e) => {
  sendActivity({
    type: "click",
    tag: e.target.tagName,
    text: e.target.innerText.trim().slice(0, 100), // limit text length for performance
    timestamp: new Date().toISOString(),
  });
});

// Throttle helper to limit how often a function runs
function throttle(fn, wait) {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= wait) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}

// Track scroll percentage and send only on significant change (5% threshold)
let lastScrollPercent = 0;

const handleScroll = throttle(() => {
  const scrollPercent = Math.round(
    (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
  );

  if (Math.abs(scrollPercent - lastScrollPercent) >= 5) {
    lastScrollPercent = scrollPercent;
    sendActivity({
      type: "scroll",
      scrollPercent,
      timestamp: new Date().toISOString(),
    });
  }
}, 1000); // limit to 1 event per second max

window.addEventListener("scroll", handleScroll);
