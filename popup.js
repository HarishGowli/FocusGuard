/*
 * ==================================================
 * FocusGuard - popup.js
 * ==================================================
 */

/*
 * --------------------------------------------------
 * DOM REFERENCES
 * --------------------------------------------------
 */

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

const cancelEditButton = document.getElementById("cancelEditButton");

/*
 * --------------------------------------------------
 * EDIT STATE
 * --------------------------------------------------
 *
 * null = creating a new block
 *
 * schedule ID = editing an existing schedule
 *
 * --------------------------------------------------
 */

let editingScheduleId = null;

/*
 * ==================================================
 * SCHEDULE EDITING
 * ==================================================
 */

/*
 * --------------------------------------------------
 * Start editing a scheduled block
 * --------------------------------------------------
 */

async function startEditingSchedule(scheduleId) {
  try {
    const result = await chrome.storage.local.get(["scheduledBlocks"]);

    const scheduledBlocks = result.scheduledBlocks || [];

    const schedule = scheduledBlocks.find((item) => item.id === scheduleId);

    if (!schedule) {
      message.textContent = "Scheduled block not found.";

      return;
    }

    /*
     * Enter edit mode.
     */

    editingScheduleId = scheduleId;

    /*
     * Set website.
     */

    websiteInput.value = schedule.domain;

    /*
     * Select scheduled mode.
     */

    blockType.value = "scheduled";

    temporaryFields.classList.add("hidden");

    scheduleFields.classList.remove("hidden");

    /*
     * Select days.
     */

    const dayCheckboxes = document.querySelectorAll(".day-checkbox");

    dayCheckboxes.forEach((checkbox) => {
      checkbox.checked = schedule.schedule.days.includes(
        Number(checkbox.value),
      );
    });

    /*
     * Set times.
     */

    startTime.value = schedule.schedule.startTime;

    endTime.value = schedule.schedule.endTime;

    /*
     * Change button text.
     */

    saveButton.textContent = "Update Schedule";

    /*
     * Show cancel button.
     */

    cancelEditButton.classList.remove("hidden");

    message.textContent = "Editing scheduled block.";
  } catch (error) {
    console.error("Failed to edit schedule:", error);

    message.textContent = "Failed to load scheduled block.";
  }
}

/*
 * --------------------------------------------------
 * Cancel schedule editing
 * --------------------------------------------------
 */

cancelEditButton.addEventListener("click", () => {
  resetScheduleForm();

  message.textContent = "";
});

/*
 * --------------------------------------------------
 * Reset schedule form
 * --------------------------------------------------
 */

function resetScheduleForm() {
  editingScheduleId = null;

  websiteInput.value = "";

  durationInput.value = "";

  startTime.value = "";

  endTime.value = "";

  /*
   * Uncheck all days.
   */

  document.querySelectorAll(".day-checkbox").forEach((checkbox) => {
    checkbox.checked = false;
  });

  /*
   * Reset mode.
   */

  blockType.value = "temporary";

  temporaryFields.classList.remove("hidden");

  scheduleFields.classList.add("hidden");

  /*
   * Reset buttons.
   */

  saveButton.textContent = "Create Block";

  cancelEditButton.classList.add("hidden");
}

/*
 * ==================================================
 * SCHEDULE MODE SWITCHING
 * ==================================================
 */

blockType.addEventListener("change", () => {
  /*
   * If user switches to temporary mode
   * while editing a schedule, exit edit mode.
   */

  if (blockType.value === "temporary") {
    temporaryFields.classList.remove("hidden");

    scheduleFields.classList.add("hidden");

    if (editingScheduleId) {
      editingScheduleId = null;

      saveButton.textContent = "Create Block";

      cancelEditButton.classList.add("hidden");
    }
  } else {
    temporaryFields.classList.add("hidden");

    scheduleFields.classList.remove("hidden");
  }
});

/*
 * ==================================================
 * SCHEDULED BLOCKS
 * ==================================================
 */

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

/*
 * --------------------------------------------------
 * Format schedule days
 * --------------------------------------------------
 */

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

/*
 * --------------------------------------------------
 * Render scheduled blocks
 * --------------------------------------------------
 */

function renderScheduledBlocks(schedules) {
  scheduledBlocksContainer.innerHTML = "";

  scheduleCount.textContent = schedules.length;

  /*
   * No schedules.
   */

  if (schedules.length === 0) {
    scheduledBlocksContainer.innerHTML = `

      <div class="empty-state">
        No scheduled blocks.
      </div>

    `;

    return;
  }

  /*
   * Create cards.
   */

  schedules.forEach((schedule) => {
    const card = document.createElement("div");

    card.className = "site-card";

    const status = schedule.active ? "ACTIVE" : "INACTIVE";

    const statusClass = schedule.active ? "active" : "inactive";

    card.innerHTML = `

        <div class="site-top">

          <span class="site-domain">
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


        <div class="schedule-actions">

          <button
            class="edit-schedule-button"
            data-schedule-id="${schedule.id}"
          >
            Edit
          </button>


          <button
            class="remove-schedule-button"
            data-schedule-id="${schedule.id}"
          >
            Remove
          </button>

        </div>

      `;

    scheduledBlocksContainer.appendChild(card);
  });

  /*
   * ------------------------------------------------
   * Attach Edit buttons
   * ------------------------------------------------
   */

  const editButtons = document.querySelectorAll(".edit-schedule-button");

  editButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const scheduleId = button.dataset.scheduleId;

      startEditingSchedule(scheduleId);
    });
  });

  /*
   * ------------------------------------------------
   * Attach Remove buttons
   * ------------------------------------------------
   */

  const removeButtons = document.querySelectorAll(".remove-schedule-button");

  removeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const scheduleId = button.dataset.scheduleId;

      removeScheduledBlock(scheduleId);
    });
  });
}

/*
 * --------------------------------------------------
 * Remove scheduled block
 * --------------------------------------------------
 */

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
        /*
         * If we removed the schedule
         * currently being edited,
         * reset the form.
         */

        if (editingScheduleId === scheduleId) {
          resetScheduleForm();
        }

        loadScheduledBlocks();
      }
    },
  );
}

/*
 * ==================================================
 * TEMPORARY BLOCKS
 * ==================================================
 */

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

    /*
     * Only show active temporary blocks.
     */

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

  /*
   * No active blocks.
   */

  if (sites.length === 0) {
    blockedSitesContainer.innerHTML = `

      <div class="empty-state">
        No active blocks.
      </div>

    `;

    return;
  }

  /*
   * Create cards.
   */

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
   * ------------------------------------------------
   * Attach Remove buttons
   * ------------------------------------------------
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
 * Remove temporary block
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
 * Update temporary countdowns
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
 * ==================================================
 * CREATE / UPDATE BLOCK
 * ==================================================
 */

saveButton.addEventListener("click", () => {
  /*
   * ----------------------------------------------
   * Normalize website
   * ----------------------------------------------
   */

  let domain;

  try {
    domain = normalizeDomain(websiteInput.value);
  } catch (error) {
    message.textContent = error.message;

    return;
  }

  /*
   * ----------------------------------------------
   * Temporary block
   * ----------------------------------------------
   */

  if (blockType.value === "temporary") {
    const duration = Number(durationInput.value);

    if (!duration || duration <= 0) {
      message.textContent = "Please enter a valid duration.";

      return;
    }

    /*
     * Temporary blocks should
     * always create a new temporary block.
     */

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
          resetScheduleForm();

          loadBlockedSites();
        }
      },
    );

    return;
  }

  /*
   * ----------------------------------------------
   * Scheduled block
   * ----------------------------------------------
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
   * ----------------------------------------------
   * Validate schedule
   * ----------------------------------------------
   */

  const validation = validateSchedule(schedule);

  if (!validation.valid) {
    message.textContent = validation.message;

    return;
  }

  /*
   * ----------------------------------------------
   * Create schedule object
   * ----------------------------------------------
   */

  const scheduledBlock = {
    type: "scheduled",

    domain: domain,

    schedule: schedule,
  };

  console.log("Scheduled block:", scheduledBlock);

  /*
   * ----------------------------------------------
   * Determine operation
   * ----------------------------------------------
   */

  const messageData = {
    type: editingScheduleId ? "UPDATE_SCHEDULE" : "CREATE_SCHEDULE",

    scheduledBlock: scheduledBlock,
  };

  /*
   * Add schedule ID when editing.
   */

  if (editingScheduleId) {
    messageData.scheduleId = editingScheduleId;
  }

  /*
   * ----------------------------------------------
   * Send to service worker
   * ----------------------------------------------
   */

  chrome.runtime.sendMessage(
    messageData,

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
        resetScheduleForm();

        loadScheduledBlocks();
      }
    },
  );
});

/*
 * ==================================================
 * INITIAL LOAD
 * ==================================================
 */

loadBlockedSites();

loadScheduledBlocks();

/*
 * ==================================================
 * STORAGE SYNCHRONIZATION
 * ==================================================
 */

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  /*
   * Temporary blocks changed.
   */

  if (changes.blockedSites) {
    loadBlockedSites();
  }

  /*
   * Scheduled blocks changed.
   */

  if (changes.scheduledBlocks) {
    loadScheduledBlocks();
  }
});
