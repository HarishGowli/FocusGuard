const websiteInput = document.getElementById("websiteInput");

const durationInput = document.getElementById("durationInput");

const saveButton = document.getElementById("saveButton");

const message = document.getElementById("message");

const blockedSitesContainer = document.getElementById("blockedSites");

const siteCount = document.getElementById("siteCount");

const blockType = document.getElementById("blockType");

const temporaryFields = document.getElementById("temporaryFields");

const scheduleFields = document.getElementById("scheduleFields");

const startTime = document.getElementById("startTime");

const endTime = document.getElementById("endTime");

const scheduledBlocksContainer = document.getElementById("scheduledBlocks");

const scheduleCount = document.getElementById("scheduleCount");

/*
 * --------------------------------------------------
 * Load scheduled blocks
 * --------------------------------------------------
 */

async function loadScheduledBlocks() {
  try {
    const result = await chrome.storage.local.get(["scheduledBlocks"]);

    const scheduledBlocks = result.scheduledBlocks || [];

    renderScheduledBlocks(scheduledBlocks);
  } catch (error) {
    console.error("Failed to load scheduled blocks:", error);
  }
}

function formatScheduleDays(days) {
  const dayNames = {
    0: "Sun",

    1: "Mon",

    2: "Tue",

    3: "Wed",

    4: "Thu",

    5: "Fri",

    6: "Sat",
  };

  return days.map((day) => dayNames[day]).join(" ");
}

function renderScheduledBlocks(schedules) {
  scheduledBlocksContainer.innerHTML = "";

  scheduleCount.textContent = schedules.length;

  if (schedules.length === 0) {
    scheduledBlocksContainer.innerHTML = `

            <div class="empty-state">

                No scheduled blocks.

            </div>

        `;

    return;
  }

  schedules.forEach((schedule) => {
    const card = document.createElement("div");

    card.className = "site-card";

    const status = schedule.active ? "ACTIVE" : "INACTIVE";

    const statusClass = schedule.active ? "active" : "";

    card.innerHTML = `

                <div class="site-top">

                    <span
                        class="site-domain"
                    >
                        ${schedule.domain}
                    </span>

                    <span
                        class="status ${statusClass}"
                    >
                        ${status}
                    </span>

                </div>


                <div class="remaining">

                    Days:
                    ${formatScheduleDays(schedule.schedule.days)}

                </div>


                <div class="remaining">

                    Time:
                    ${schedule.schedule.startTime}
                    →
                    ${schedule.schedule.endTime}

                </div>


                <button
                    class="remove-schedule-button"
                    data-schedule-id="${schedule.id}"
                >
                    Remove Schedule
                </button>

            `;

    scheduledBlocksContainer.appendChild(card);
  });

  /*
   * Attach remove buttons.
   */

  const removeButtons = document.querySelectorAll(".remove-schedule-button");

  removeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const scheduleId = button.dataset.scheduleId;

      removeScheduledBlock(scheduleId);
    });
  });
}

function removeScheduledBlock(scheduleId) {
  chrome.runtime.sendMessage(
    {
      type: "REMOVE_SCHEDULE",

      scheduleId: scheduleId,
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
        loadScheduledBlocks();
      }
    },
  );
}

blockType.addEventListener("change", () => {
  if (blockType.value === "scheduled") {
    temporaryFields.classList.add("hidden");

    scheduleFields.classList.remove("hidden");
  } else {
    temporaryFields.classList.remove("hidden");

    scheduleFields.classList.add("hidden");
  }
});
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
 * Create block
 * --------------------------------------------------
 */

saveButton.addEventListener("click", () => {
  /*
   * ------------------------------------------
   * Normalize website
   * ------------------------------------------
   */

  let domain;

  try {
    domain = normalizeDomain(websiteInput.value);
  } catch (error) {
    message.textContent = error.message;

    return;
  }

  /*
   * ------------------------------------------
   * Temporary block
   * ------------------------------------------
   */

  if (blockType.value === "temporary") {
    const duration = Number(durationInput.value);

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

    return;
  }

  /*
   * ------------------------------------------
   * Scheduled block
   * ------------------------------------------
   */

  const dayCheckboxes = document.querySelectorAll(".day-checkbox:checked");

  const selectedDays = Array.from(dayCheckboxes).map((checkbox) =>
    Number(checkbox.value),
  );

  const schedule = {
    days: selectedDays,

    startTime: startTime.value,

    endTime: endTime.value,
  };

  /*
   * ------------------------------------------
   * Validate schedule
   * ------------------------------------------
   */

  const validation = validateSchedule(schedule);

  if (!validation.valid) {
    message.textContent = validation.message;

    return;
  }

  /*
   * ------------------------------------------
   * Create schedule object
   * ------------------------------------------
   */

  const scheduledBlock = {
    type: "scheduled",

    domain: domain,

    schedule: schedule,
  };

  console.log("Scheduled block:", scheduledBlock);

  /*
   * ------------------------------------------
   * Send schedule to service worker
   * ------------------------------------------
   *
   * IMPORTANT:
   *
   * The service worker does NOT activate
   * scheduled blocking yet.
   *
   * We are only testing the data flow.
   * ------------------------------------------
   */

  chrome.runtime.sendMessage(
    {
      type: "CREATE_SCHEDULE",

      scheduledBlock: scheduledBlock,
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
    },
  );
});
/*
 * --------------------------------------------------
 * Initial load
 * --------------------------------------------------
 */

loadBlockedSites();

loadScheduledBlocks();

/*
 * --------------------------------------------------
 * Listen for storage changes
 * --------------------------------------------------
 */

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  if (changes.blockedSites) {
    loadBlockedSites();
  }

  if (changes.scheduledBlocks) {
    loadScheduledBlocks();
  }
});
