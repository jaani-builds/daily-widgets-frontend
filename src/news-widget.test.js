/**
 * Test suite for news-widget.js
 * Tests fallback logic and location-based news loading
 */

import { createNewsWidget } from "./news-widget.js";

// Mock API responses
const mockNewsList = {
  singapore: {
    city: "Singapore",
    country: "Singapore",
    count: 3,
    articles: [
      {
        title: "Singapore tech news today",
        url: "https://example.com/sg-tech",
        source: "Tech Daily",
        published_at: "2026-04-02T10:00:00Z",
      },
      {
        title: "Singapore finance update",
        url: "https://example.com/sg-fin",
        source: "Finance News",
        published_at: "2026-04-02T09:30:00Z",
      },
      {
        title: "Singapore weather forecast",
        url: "https://example.com/sg-weather",
        source: "Weather",
        published_at: "2026-04-02T09:00:00Z",
      },
    ],
  },
  chennai: {
    city: "Chennai",
    country: "India",
    count: 2,
    articles: [
      {
        title: "Chennai weather alert",
        url: "https://example.com/ch-weather",
        source: "Weather Alert",
        published_at: "2026-04-02T11:00:00Z",
      },
      {
        title: "Chennai local news",
        url: "https://example.com/ch-local",
        source: "Local",
        published_at: "2026-04-02T10:30:00Z",
      },
    ],
  },
};

// Mock getJson function
function createMockGetJson() {
  return async (endpoint, params) => {
    if (endpoint === "/news") {
      const city = params.city?.toLowerCase();
      const state = params.state?.toLowerCase();
      const country = params.country?.toLowerCase();

      // Prefer city+country combination for most specific results
      if ((city === "temasek" || city === "singapore") && (country === "singapore")) {
        return mockNewsList.singapore;
      } else if (city === "singapore" || country === "singapore") {
        return mockNewsList.singapore;
      } else if ((city === "chennai" || state === "chennai") && (country === "india")) {
        return mockNewsList.chennai;
      } else if (city === "chennai" || country === "india") {
        return mockNewsList.chennai;
      } else if (city === "timeout-test") {
        // Simulate timeout
        return new Promise(() => {}); // Never resolves
      }
      return { articles: [], count: 0 };
    }
  };
}

// Mock setStatus function
const mockSetStatus = (msg) => {
  console.log("[STATUS]", msg);
};

// Test cases
const tests = [
  {
    name: "Load news for Singapore by city",
    location: { city: "Singapore" },
    expectedArticles: 3,
    expectedContext: "Top 3 headlines for Singapore",
  },
  {
    name: "Load news for Singapore by country",
    location: { country: "Singapore" },
    expectedArticles: 3,
    expectedContext: "Top 3 headlines for Singapore",
  },
  {
    name: "Fallback: city priority over state",
    location: { city: "Singapore", state: "NotAState" },
    expectedArticles: 3,
    expectedContext: "Top 3 headlines for Singapore",
  },
  {
    name: "Fallback: state priority over country",
    location: { state: "NotAState", country: "Singapore" },
    expectedArticles: 3,
    expectedContext: "Top 3 headlines for NotAState, Singapore",
  },
  {
    name: "Load news for Chennai by city",
    location: { city: "Chennai" },
    expectedArticles: 2,
    expectedContext: "Top 2 headlines for Chennai",
  },
  {
    name: "Load news for India by country",
    location: { country: "India" },
    expectedArticles: 2,
    expectedContext: "Top 2 headlines for India",
  },
  {
    name: "City + country combination (Temasek + Singapore)",
    location: { city: "Temasek", country: "Singapore" },
    expectedArticles: 3,
    expectedContext: "Top 3 headlines for Temasek, Singapore",
  },
  {
    name: "No location provided",
    location: {},
    expectedArticles: 0,
    expectedContext: "Location required",
  },
];

async function runTests() {
  console.log("\n=== News Widget Test Suite ===\n");

  const mockGetJson = createMockGetJson();
  const newsWidget = createNewsWidget({ getJson: mockGetJson, setStatus: mockSetStatus });

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      // Create DOM elements for this test
      const container = createTestContainer();
      await newsWidget.loadNews(test.location, { silent: true });

      // Get rendered results
      const listEl = document.querySelector("#news-list");
      const contextEl = document.querySelector("#news-context");
      const articleCount = listEl ? listEl.querySelectorAll("li").length : 0;
      const contextText = contextEl?.textContent || "";

      // Validate
      const articlesMatch = articleCount === test.expectedArticles;
      const contextMatch = contextText.includes(test.expectedContext) || test.expectedArticles === 0;

      if (articlesMatch && contextMatch) {
        console.log(`✅ PASS: ${test.name}`);
        console.log(`   Articles: ${articleCount}, Context: "${contextText}"`);
        passed++;
      } else {
        console.log(`❌ FAIL: ${test.name}`);
        console.log(`   Expected: ${test.expectedArticles} articles, context: "${test.expectedContext}"`);
        console.log(`   Got: ${articleCount} articles, context: "${contextText}"`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${test.name}`);
      console.log(`   ${error.message}`);
      failed++;
    }

    cleanupTestContainer();
  }

  console.log(`\n=== Results ===`);
  console.log(`Passed: ${passed}/${tests.length}`);
  console.log(`Failed: ${failed}/${tests.length}`);
  console.log(failed === 0 ? "\n✅ All tests passed!" : "\n⚠️  Some tests failed");
}

function createTestContainer() {
  const container = document.createElement("div");
  container.id = "test-container";
  container.innerHTML = `
    <form id="news-form" style="display: none;">
      <input id="news-city" type="text" />
      <input id="news-state" type="text" />
      <input id="news-country" type="text" />
      <button id="news-submit">Load</button>
    </form>
    <p id="news-context" class="muted mono"></p>
    <ol id="news-list" class="weather-news-list mono"></ol>
  `;
  document.body.appendChild(container);
  return container;
}

function cleanupTestContainer() {
  const container = document.querySelector("#test-container");
  if (container) {
    container.remove();
  }
}

// Run tests if in test environment
if (typeof window !== "undefined") {
  window.newsWidgetTests = { runTests };
  console.log("News widget tests loaded. Run: window.newsWidgetTests.runTests()");
}

export { runTests };
