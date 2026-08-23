const websiteInput = document.getElementById("websiteInput");

const durationInput = document.getElementById("durationInput");

const saveButton = document.getElementById("saveButton");

const message = document.getElementById("message");

const blockedSitesContainer = document.getElementById("blockedSites");

const siteCount = document.getElementById("siteCount");

/*
 * --------------------------------------------------
 * Format remaining time
 * --------------------------------------------------
 */

function formatRemainingTime(milliseconds) {
  if (milliseconds <= 0) {
    return "Expired";
  }

  const totalSeconds = Math.ceil(milliseconds / 1000);

  const hours = Math.floor(totalSeconds / 3600);

  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const seconds = totalSeconds % 60;

  return (
    String(hours).padStart(2, "0") +
    ":" +
    String(minutes).padStart(2, "0") +
    ":" +
    String(seconds).padStart(2, "0")
  );
}

/*
 * --------------------------------------------------
 * Load blocked websites
 * --------------------------------------------------
 */

async function loadBlockedSites() {
  try {
    const result = await chrome.storage.local.get(["blockedSites"]);

    const blockedSites = result.blockedSites || [];

    const activeSites = blockedSites.filter(
      (site) => site.expiresAt > Date.now(),
    );

    renderBlockedSites(activeSites);
  } catch (error) {
    console.error("Failed to load sites:", error);
  }
}

/*
 * --------------------------------------------------
 * Render blocked websites
 * --------------------------------------------------
 */

function renderBlockedSites(sites) {
  blockedSitesContainer.innerHTML = "";

  siteCount.textContent = sites.length;

  if (sites.length === 0) {
    blockedSitesContainer.innerHTML = `

            <div class="empty-state">
                No active blocks.
            </div>

        `;

    return;
  }

  sites.forEach((site) => {
    const card = document.createElement("div");

    card.className = "site-card";

    card.innerHTML = `

            <div class="site-top">

                <span class="site-domain">
                    ${site.domain}
                </span>

                <span class="status active">
                    BLOCKED
                </span>

            </div>


            <div
                class="remaining"
                data-expires-at="${site.expiresAt}"
            >
                Remaining:
                ${formatRemainingTime(site.expiresAt - Date.now())}
            </div>


            <button
                class="remove-button"
                data-domain="${site.domain}"
            >
                Remove Block
            </button>

        `;

    blockedSitesContainer.appendChild(card);
  });

  /*
   * Attach Remove buttons
   */

  const removeButtons = document.querySelectorAll(".remove-button");

  removeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const domain = button.dataset.domain;

      removeBlock(domain);
    });
  });
}

/*
 * --------------------------------------------------
 * Remove block
 * --------------------------------------------------
 */

function removeBlock(domain) {
  chrome.runtime.sendMessage(
    {
      type: "REMOVE_BLOCK",

      domain: domain,
    },

    (response) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);

        message.textContent = "Extension error.";

        return;
      }

      if (!response) {
        message.textContent = "No response from service worker.";

        return;
      }

      message.textContent = response.message;

      if (response.success) {
        loadBlockedSites();
      }
    },
  );
}

/*
 * --------------------------------------------------
 * Update countdowns
 * --------------------------------------------------
 */

function updateCountdowns() {
  const remainingElements = document.querySelectorAll("[data-expires-at]");

  remainingElements.forEach((element) => {
    const expiresAt = Number(element.dataset.expiresAt);

    const remaining = expiresAt - Date.now();

    if (remaining <= 0) {
      element.textContent = "Expired";
    } else {
      element.textContent = `Remaining: ${formatRemainingTime(remaining)}`;
    }
  });
}

setInterval(updateCountdowns, 1000);

/*
 * --------------------------------------------------
 * Block website
 * --------------------------------------------------
 */

saveButton.addEventListener("click", () => {
  let domain;

  try {
    domain = normalizeDomain(websiteInput.value);
  } catch (error) {
    message.textContent = error.message;

    return;
  }

  const duration = Number(durationInput.value);

  if (domain === "") {
    message.textContent = "Please enter a website.";

    return;
  }

  if (!duration || duration <= 0) {
    message.textContent = "Please enter a valid duration.";

    return;
  }

  chrome.runtime.sendMessage(
    {
      type: "BLOCK_WEBSITE",

      domain: domain,

      duration: duration,
    },

    (response) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);

        message.textContent = "Extension error.";

        return;
      }

      if (!response) {
        message.textContent = "No response from service worker.";

        return;
      }

      message.textContent = response.message;

      if (response.success) {
        websiteInput.value = "";

        durationInput.value = "";

        loadBlockedSites();
      }
    },
  );
});

/*
 * --------------------------------------------------
 * Initial load
 * --------------------------------------------------
 */

loadBlockedSites();

/*
 * --------------------------------------------------
 * Listen for storage changes
 * --------------------------------------------------
 */

chrome.storage.onChanged.addListener(
    (
        changes,
        areaName
    ) => {

        if (
            areaName === "local" &&
            changes.blockedSites
        ) {

            loadBlockedSites();

        }

    }
);