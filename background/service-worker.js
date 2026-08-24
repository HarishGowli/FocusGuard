/*
 * ============================================================
 * FocusGuard - Service Worker
 * ============================================================
 *
 * Responsibilities:
 *
 * 1. Temporary website blocking
 * 2. Temporary block expiration
 * 3. Manual block removal
 * 4. Scheduled website blocking
 * 5. Scheduled block activation/deactivation
 * 6. Alarm management
 * 7. Storage management
 * 8. Startup recovery
 *
 * ============================================================
 */

/*
 * ------------------------------------------------------------
 * IMPORT UTILITIES
 * ------------------------------------------------------------
 *
 * domain.js
 *     -> normalizeDomain()
 *
 * schedule.js
 *     -> validateSchedule()
 *
 * schedule-engine.js
 *     -> isScheduleCurrentlyActive()
 *     -> getNextScheduleTransition()
 *
 * ------------------------------------------------------------
 */

importScripts(
  "../utils/domain.js",
  "../utils/schedule.js",
  "../utils/schedule-engine.js",
);

/*
 * ------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------
 */

const FIRST_RULE_ID = 1001;

/*
 * ------------------------------------------------------------
 * Service worker started
 * ------------------------------------------------------------
 */

console.log("FocusGuard background service worker started.");

/*
 * ============================================================
 * RULE ID MANAGEMENT
 * ============================================================
 */

/*
 * ------------------------------------------------------------
 * Get next available rule ID
 * ------------------------------------------------------------
 */

async function getNextRuleId() {
  const result = await chrome.storage.local.get(["nextRuleId"]);

  const nextRuleId = result.nextRuleId || FIRST_RULE_ID;

  await chrome.storage.local.set({
    nextRuleId: nextRuleId + 1,
  });

  return nextRuleId;
}

/*
 * ============================================================
 * TEMPORARY BLOCK STORAGE
 * ============================================================
 */

/*
 * ------------------------------------------------------------
 * Get temporary blocked websites
 * ------------------------------------------------------------
 */

async function getBlockedSites() {
  const result = await chrome.storage.local.get(["blockedSites"]);

  return result.blockedSites || [];
}

/*
 * ------------------------------------------------------------
 * Save temporary blocked websites
 * ------------------------------------------------------------
 */

async function saveBlockedSites(blockedSites) {
  await chrome.storage.local.set({
    blockedSites: blockedSites,
  });
}

/*
 * ============================================================
 * SCHEDULED BLOCK STORAGE
 * ============================================================
 */

/*
 * ------------------------------------------------------------
 * Get scheduled blocks
 * ------------------------------------------------------------
 */

async function getScheduledBlocks() {
  const result = await chrome.storage.local.get(["scheduledBlocks"]);

  return result.scheduledBlocks || [];
}

/*
 * ------------------------------------------------------------
 * Save scheduled blocks
 * ------------------------------------------------------------
 */

async function saveScheduledBlocks(scheduledBlocks) {
  await chrome.storage.local.set({
    scheduledBlocks: scheduledBlocks,
  });
}

/*
 * ============================================================
 * TEMPORARY BLOCK ALARMS
 * ============================================================
 */

/*
 * ------------------------------------------------------------
 * Create temporary unblock alarm
 * ------------------------------------------------------------
 */

async function createUnblockAlarm(domain, expiresAt) {
  const alarmName = `unblock:${domain}`;

  await chrome.alarms.create(alarmName, {
    when: expiresAt,
  });

  console.log("Unblock alarm created:", alarmName);
}

/*
 * ============================================================
 * BLOCKED PAGE URL
 * ============================================================
 */

/*
 * ------------------------------------------------------------
 * Build temporary blocked page URL
 * ------------------------------------------------------------
 */

function buildBlockedPageUrl(domain, expiresAt) {
  const params = new URLSearchParams({
    domain: domain,

    expiresAt: String(expiresAt),
  });

  return chrome.runtime.getURL(`blocked/blocked.html?${params.toString()}`);
}

/*
 * ============================================================
 * TEMPORARY REDIRECT RULE
 * ============================================================
 */

/*
 * ------------------------------------------------------------
 * Create temporary redirect rule
 * ------------------------------------------------------------
 */

function createRedirectRule(ruleId, domain, expiresAt) {
  const blockedPageUrl = buildBlockedPageUrl(domain, expiresAt);

  return {
    id: ruleId,

    priority: 1,

    action: {
      type: "redirect",

      redirect: {
        url: blockedPageUrl,
      },
    },

    condition: {
      urlFilter: `||${domain}`,

      resourceTypes: ["main_frame"],
    },
  };
}

/*
 * ============================================================
 * SCHEDULED REDIRECT RULE
 * ============================================================
 */

/*
 * ------------------------------------------------------------
 * Create scheduled redirect rule
 * ------------------------------------------------------------
 */

function createScheduledRedirectRule(ruleId, domain) {
  const blockedPageUrl = chrome.runtime.getURL(
    `blocked/blocked.html?domain=${encodeURIComponent(domain)}&scheduled=true`,
  );

  return {
    id: ruleId,

    /*
     * Scheduled rules have higher priority
     * than temporary rules.
     */

    priority: 10,

    action: {
      type: "redirect",

      redirect: {
        url: blockedPageUrl,
      },
    },

    condition: {
      urlFilter: `||${domain}`,

      resourceTypes: ["main_frame"],
    },
  };
}

/*
 * ============================================================
 * MESSAGE LISTENER
 * ============================================================
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received:", message);

  /*
   * ----------------------------------------------------
   * Temporary block
   * ----------------------------------------------------
   */

  if (message.type === "BLOCK_WEBSITE") {
    handleBlockWebsite(message)
      .then((response) => {
        sendResponse(response);
      })

      .catch((error) => {
        console.error("Blocking error:", error);

        sendResponse({
          success: false,

          message: "Something went wrong.",
        });
      });

    return true;
  }

  /*
   * ----------------------------------------------------
   * Manual remove block
   * ----------------------------------------------------
   */

  if (message.type === "REMOVE_BLOCK") {
    handleRemoveBlock(message.domain)
      .then((response) => {
        sendResponse(response);
      })

      .catch((error) => {
        console.error("Remove block error:", error);

        sendResponse({
          success: false,

          message: "Failed to remove block.",
        });
      });

    return true;
  }

  /*
   * ----------------------------------------------------
   * Create scheduled block
   * ----------------------------------------------------
   */

  if (message.type === "CREATE_SCHEDULE") {
    handleCreateSchedule(message.scheduledBlock)
      .then((response) => {
        sendResponse(response);
      })

      .catch((error) => {
        console.error("Schedule creation error:", error);

        sendResponse({
          success: false,

          message: "Failed to create schedule.",
        });
      });

    return true;
  }

  if (message.type === "REMOVE_SCHEDULE") {
    handleRemoveSchedule(message.scheduleId)
      .then((response) => {
        sendResponse(response);
      })

      .catch((error) => {
        console.error("Remove schedule error:", error);

        sendResponse({
          success: false,

          message: "Failed to remove schedule.",
        });
      });

    return true;
  }
});

/*
 * ============================================================
 * TEMPORARY BLOCK
 * ============================================================
 */

/*
 * ------------------------------------------------------------
 * Handle temporary website blocking
 * ------------------------------------------------------------
 */

async function handleBlockWebsite(message) {
  /*
   * --------------------------------------------------------
   * Normalize and validate domain
   * --------------------------------------------------------
   */

  let domain;

  try {
    domain = normalizeDomain(message.domain);
  } catch (error) {
    return {
      success: false,

      message: error.message,
    };
  }

  /*
   * --------------------------------------------------------
   * Validate duration
   * --------------------------------------------------------
   */

  const duration = Number(message.duration);

  if (!duration || duration <= 0) {
    return {
      success: false,

      message: "Duration must be greater than zero.",
    };
  }

  /*
   * --------------------------------------------------------
   * Get existing temporary blocks
   * --------------------------------------------------------
   */

  const blockedSites = await getBlockedSites();

  /*
   * --------------------------------------------------------
   * Check duplicate temporary block
   * --------------------------------------------------------
   */

  const existingSiteIndex = blockedSites.findIndex(
    (site) => site.domain === domain,
  );

  /*
   * ========================================================
   * EXISTING TEMPORARY BLOCK
   * ========================================================
   */

  if (existingSiteIndex !== -1) {
    const existingSite = blockedSites[existingSiteIndex];

    const currentTime = Date.now();

    const expiresAt = currentTime + duration * 60 * 1000;

    /*
     * Create updated rule.
     */

    const updatedRule = createRedirectRule(
      existingSite.ruleId,
      domain,
      expiresAt,
    );

    /*
     * Replace old DNR rule.
     */

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [existingSite.ruleId],

      addRules: [updatedRule],
    });

    /*
     * Update expiration.
     */

    existingSite.expiresAt = expiresAt;

    await saveBlockedSites(blockedSites);

    /*
     * Replace alarm.
     */

    await createUnblockAlarm(domain, expiresAt);

    console.log("Existing temporary block updated:", domain);

    return {
      success: true,

      message: `${domain} block time updated.`,
    };
  }

  /*
   * ========================================================
   * NEW TEMPORARY BLOCK
   * ========================================================
   */

  const ruleId = await getNextRuleId();

  const currentTime = Date.now();

  const expiresAt = currentTime + duration * 60 * 1000;

  /*
   * Create DNR rule.
   */

  const rule = createRedirectRule(ruleId, domain, expiresAt);

  /*
   * Add rule.
   */

  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [rule],
  });

  /*
   * Save website.
   */

  blockedSites.push({
    domain: domain,

    expiresAt: expiresAt,

    ruleId: ruleId,
  });

  await saveBlockedSites(blockedSites);

  /*
   * Create expiration alarm.
   */

  await createUnblockAlarm(domain, expiresAt);

  console.log("Temporary website blocked:", domain);

  console.log("Temporary rule ID:", ruleId);

  console.log("Blocked page:", buildBlockedPageUrl(domain, expiresAt));

  return {
    success: true,

    message: `${domain} is now blocked.`,
  };
}

/*
 * ============================================================
 * MANUAL REMOVE TEMPORARY BLOCK
 * ============================================================
 */

/*
 * ------------------------------------------------------------
 * Remove a temporary block manually
 * ------------------------------------------------------------
 */

async function handleRemoveBlock(domain) {
  let normalizedDomain;

  /*
   * Normalize domain.
   */

  try {
    normalizedDomain = normalizeDomain(domain);
  } catch (error) {
    return {
      success: false,

      message: error.message,
    };
  }

  /*
   * Get temporary blocks.
   */

  const blockedSites = await getBlockedSites();

  /*
   * Find website.
   */

  const siteIndex = blockedSites.findIndex(
    (site) => site.domain === normalizedDomain,
  );

  /*
   * Website isn't blocked.
   */

  if (siteIndex === -1) {
    return {
      success: false,

      message: `${normalizedDomain} is not currently blocked.`,
    };
  }

  const site = blockedSites[siteIndex];

  /*
   * Remove DNR rule.
   */

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [site.ruleId],
  });

  /*
   * Remove alarm.
   */

  await chrome.alarms.clear(`unblock:${normalizedDomain}`);

  /*
   * Remove from storage.
   */

  blockedSites.splice(siteIndex, 1);

  await saveBlockedSites(blockedSites);

  console.log("Temporary block manually removed:", normalizedDomain);

  return {
    success: true,

    message: `${normalizedDomain} block removed.`,
  };
}

/*
 * ============================================================
 * TEMPORARY BLOCK CLEANUP
 * ============================================================
 */

/*
 * ------------------------------------------------------------
 * Cleanup expired temporary blocks
 * ------------------------------------------------------------
 */

async function cleanupExpiredBlocks() {
  const blockedSites = await getBlockedSites();

  const now = Date.now();

  const expiredSites = blockedSites.filter((site) => site.expiresAt <= now);

  /*
   * Nothing expired.
   */

  if (expiredSites.length === 0) {
    return;
  }

  /*
   * Collect expired rule IDs.
   */

  const ruleIds = expiredSites.map((site) => site.ruleId);

  /*
   * Remove expired DNR rules.
   */

  if (ruleIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIds,
    });
  }

  /*
   * Keep only active temporary blocks.
   */

  const activeSites = blockedSites.filter((site) => site.expiresAt > now);

  await saveBlockedSites(activeSites);

  /*
   * Clear expired alarms.
   */

  for (const site of expiredSites) {
    await chrome.alarms.clear(`unblock:${site.domain}`);
  }

  console.log("Expired temporary blocks cleaned up:", expiredSites);
}

/*
 * ============================================================
 * RESTORE TEMPORARY BLOCK ALARMS
 * ============================================================
 */

/*
 * ------------------------------------------------------------
 * Restore alarms for active temporary blocks
 * ------------------------------------------------------------
 */

async function restoreAlarms() {
  const blockedSites = await getBlockedSites();

  const now = Date.now();

  for (const site of blockedSites) {
    /*
     * Skip already expired blocks.
     */

    if (site.expiresAt <= now) {
      continue;
    }

    await createUnblockAlarm(site.domain, site.expiresAt);
  }

  console.log("Active temporary block alarms restored.");
}

/*
 * ============================================================
 * SCHEDULED BLOCK ACTIVATION
 * ============================================================
 */

/*
 * ------------------------------------------------------------
 * Activate scheduled block
 * ------------------------------------------------------------
 */

/*
 * --------------------------------------------------
 * Activate scheduled block
 * --------------------------------------------------
 */

async function activateScheduledBlock(scheduledBlock) {
  /*
   * Check whether the rule already exists.
   */

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();

  const ruleAlreadyExists = existingRules.some(
    (rule) => rule.id === scheduledBlock.ruleId,
  );

  /*
   * If the rule already exists,
   * don't try to add it again.
   */

  if (ruleAlreadyExists) {
    scheduledBlock.active = true;

    const scheduledBlocks = await getScheduledBlocks();

    const index = scheduledBlocks.findIndex(
      (item) => item.id === scheduledBlock.id,
    );

    if (index !== -1) {
      scheduledBlocks[index] = scheduledBlock;

      await saveScheduledBlocks(scheduledBlocks);
    }

    console.log(
      "Scheduled rule already exists:",
      scheduledBlock.domain,
      scheduledBlock.ruleId,
    );

    return;
  }

  /*
   * Rule doesn't exist.
   * Create it.
   */

  const rule = createScheduledRedirectRule(
    scheduledBlock.ruleId,
    scheduledBlock.domain,
  );

  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [rule],
  });

  scheduledBlock.active = true;

  const scheduledBlocks = await getScheduledBlocks();

  const index = scheduledBlocks.findIndex(
    (item) => item.id === scheduledBlock.id,
  );

  if (index !== -1) {
    scheduledBlocks[index] = scheduledBlock;

    await saveScheduledBlocks(scheduledBlocks);
  }

  console.log(
    "Scheduled block activated:",
    scheduledBlock.domain,
    scheduledBlock.ruleId,
  );
}

/*
 * ============================================================
 * SCHEDULED BLOCK DEACTIVATION
 * ============================================================
 */

/*
 * ------------------------------------------------------------
 * Deactivate scheduled block
 * ------------------------------------------------------------
 */

async function deactivateScheduledBlock(scheduledBlock) {
  /*
   * Already inactive.
   */

  if (!scheduledBlock.active) {
    return;
  }

  /*
   * Remove DNR rule.
   */

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [scheduledBlock.ruleId],
  });

  /*
   * Update state.
   */

  scheduledBlock.active = false;

  /*
   * Save updated state.
   */

  const scheduledBlocks = await getScheduledBlocks();

  const index = scheduledBlocks.findIndex(
    (item) => item.id === scheduledBlock.id,
  );

  if (index !== -1) {
    scheduledBlocks[index] = scheduledBlock;

    await saveScheduledBlocks(scheduledBlocks);
  }

  console.log("Scheduled block deactivated:", scheduledBlock.domain);
}

/*
 * ============================================================
 * SCHEDULE NEXT TRANSITION
 * ============================================================
 */

/*
 * ------------------------------------------------------------
 * Schedule next start/end transition
 * ------------------------------------------------------------
 */

async function scheduleNextTransition(scheduledBlock) {
  const nextTransition = getNextScheduleTransition(scheduledBlock.schedule);

  /*
   * No future transition.
   */

  if (!nextTransition) {
    console.log("No future schedule transition found:", scheduledBlock.domain);

    return;
  }

  const alarmName = `schedule:${scheduledBlock.id}`;

  /*
   * Create or replace alarm.
   *
   * Chrome replaces an alarm with
   * the same name.
   */

  await chrome.alarms.create(alarmName, {
    when: nextTransition.timestamp,
  });

  console.log(
    "Next schedule transition:",
    scheduledBlock.domain,
    nextTransition.type,
    new Date(nextTransition.timestamp),
  );
}

/*
 * ============================================================
 * SYNCHRONIZE SCHEDULED BLOCK
 * ============================================================
 */

/*
 * ------------------------------------------------------------
 * Synchronize one scheduled block
 * ------------------------------------------------------------
 */

async function synchronizeScheduledBlock(scheduledBlock) {
  /*
   * Determine whether schedule
   * should be active right now.
   */

  const currentlyActive = isScheduleCurrentlyActive(scheduledBlock.schedule);

  /*
   * Schedule should be active,
   * but currently isn't.
   */

  if (currentlyActive && !scheduledBlock.active) {
    await activateScheduledBlock(scheduledBlock);
  }

  /*
   * Schedule should NOT be active,
   * but currently is.
   */

  if (!currentlyActive && scheduledBlock.active) {
    await deactivateScheduledBlock(scheduledBlock);
  }

  /*
   * Always schedule the next transition.
   */

  await scheduleNextTransition(scheduledBlock);
}

/*
 * ============================================================
 * CREATE SCHEDULED BLOCK
 * ============================================================
 */

/*
 * ------------------------------------------------------------
 * Handle CREATE_SCHEDULE message
 * ------------------------------------------------------------
 */

async function handleCreateSchedule(scheduledBlock) {
  /*
   * Validate object.
   */

  if (!scheduledBlock || typeof scheduledBlock !== "object") {
    return {
      success: false,

      message: "Invalid scheduled block.",
    };
  }

  /*
   * --------------------------------------------------------
   * Normalize domain
   * --------------------------------------------------------
   */

  let domain;

  try {
    domain = normalizeDomain(scheduledBlock.domain);
  } catch (error) {
    return {
      success: false,

      message: error.message,
    };
  }

  /*
   * --------------------------------------------------------
   * Validate schedule
   * --------------------------------------------------------
   */

  const validation = validateSchedule(scheduledBlock.schedule);

  if (!validation.valid) {
    return {
      success: false,

      message: validation.message,
    };
  }

  /*
   * --------------------------------------------------------
   * Get existing schedules
   * --------------------------------------------------------
   */

  const scheduledBlocks = await getScheduledBlocks();

  /*
   * --------------------------------------------------------
   * Find existing schedule for domain
   * --------------------------------------------------------
   */

  const existingIndex = scheduledBlocks.findIndex(
    (item) => item.domain === domain,
  );

  /*
   * ========================================================
   * UPDATE EXISTING SCHEDULE
   * ========================================================
   */

  if (existingIndex !== -1) {
    const existing = scheduledBlocks[existingIndex];

    /*
     * If currently active,
     * remove the old DNR rule first.
     */

    if (existing.active) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [existing.ruleId],
      });
    }

    /*
     * Remove old schedule alarm.
     */

    await chrome.alarms.clear(`schedule:${existing.id}`);

    /*
     * Replace schedule.
     */

    existing.schedule = scheduledBlock.schedule;

    existing.active = false;

    scheduledBlocks[existingIndex] = existing;

    await saveScheduledBlocks(scheduledBlocks);

    /*
     * Immediately synchronize
     * the updated schedule.
     */

    await synchronizeScheduledBlock(existing);

    console.log("Scheduled block updated:", existing);

    return {
      success: true,

      message: `${domain} schedule updated.`,
    };
  }

  /*
   * ========================================================
   * CREATE NEW SCHEDULE
   * ========================================================
   */

  const ruleId = await getNextRuleId();

  const scheduleId = `schedule-${ruleId}`;

  const newScheduledBlock = {
    id: scheduleId,

    type: "scheduled",

    domain: domain,

    schedule: scheduledBlock.schedule,

    ruleId: ruleId,

    active: false,
  };

  /*
   * Save schedule.
   */

  scheduledBlocks.push(newScheduledBlock);

  await saveScheduledBlocks(scheduledBlocks);

  /*
   * Immediately determine whether
   * the schedule should currently
   * be active.
   */

  await synchronizeScheduledBlock(newScheduledBlock);

  console.log("Scheduled block created:", newScheduledBlock);

  return {
    success: true,

    message: `${domain} schedule created successfully.`,
  };
}

/*
 * ============================================================
 * ALARM LISTENER
 * ============================================================
 */

chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log("Alarm fired:", alarm.name);

  /*
   * ====================================================
   * SCHEDULED BLOCK ALARM
   * ====================================================
   */

  if (alarm.name.startsWith("schedule:")) {
    const scheduleId = alarm.name.replace("schedule:", "");

    const scheduledBlocks = await getScheduledBlocks();

    const scheduledBlock = scheduledBlocks.find(
      (item) => item.id === scheduleId,
    );

    /*
     * Schedule no longer exists.
     */

    if (!scheduledBlock) {
      console.log("Scheduled block not found:", scheduleId);

      return;
    }

    /*
     * Recalculate state.
     */

    await synchronizeScheduledBlock(scheduledBlock);

    return;
  }

  /*
   * ====================================================
   * TEMPORARY UNBLOCK ALARM
   * ====================================================
   */

  if (alarm.name.startsWith("unblock:")) {
    /*
     * Extract domain.
     */

    const domain = alarm.name.replace("unblock:", "");

    console.log("Temporary block expiration:", domain);

    /*
     * Get temporary blocks.
     */

    const blockedSites = await getBlockedSites();

    /*
     * Find website.
     */

    const siteIndex = blockedSites.findIndex((site) => site.domain === domain);

    /*
     * Nothing to remove.
     */

    if (siteIndex === -1) {
      console.log("Temporary website not found:", domain);

      return;
    }

    const site = blockedSites[siteIndex];

    /*
     * Remove redirect rule.
     */

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [site.ruleId],
    });

    /*
     * Remove from storage.
     */

    blockedSites.splice(siteIndex, 1);

    await saveBlockedSites(blockedSites);

    console.log("Temporary website successfully unblocked:", domain);

    return;
  }
});

/*
 * ============================================================
 * RESTORE SCHEDULED BLOCKS
 * ============================================================
 */

/*
 * ------------------------------------------------------------
 * Restore all scheduled blocks
 * ------------------------------------------------------------
 */

async function restoreScheduledBlocks() {
  const scheduledBlocks = await getScheduledBlocks();

  for (const scheduledBlock of scheduledBlocks) {
    try {
      await synchronizeScheduledBlock(scheduledBlock);
    } catch (error) {
      console.error(
        "Failed to restore scheduled block:",
        scheduledBlock.domain,
        error,
      );
    }
  }

  console.log("Scheduled blocks restored.");
}

/*
 * ============================================================
 * SERVICE WORKER STARTUP RECOVERY
 * ============================================================
 */

/*
 * ------------------------------------------------------------
 * Initial startup recovery
 * ------------------------------------------------------------
 */

(async () => {
  try {
    /*
     * Clean expired temporary blocks.
     */

    await cleanupExpiredBlocks();

    /*
     * Restore temporary block alarms.
     */

    await restoreAlarms();

    /*
     * Restore scheduled blocks
     * and their transition alarms.
     */

    await restoreScheduledBlocks();

    console.log("FocusGuard startup recovery completed.");
  } catch (error) {
    console.error("FocusGuard startup recovery failed:", error);
  }
})();

/*
 * --------------------------------------------------
 * Remove scheduled block
 * --------------------------------------------------
 */

async function handleRemoveSchedule(scheduleId) {
  const scheduledBlocks = await getScheduledBlocks();

  const index = scheduledBlocks.findIndex(
    (schedule) => schedule.id === scheduleId,
  );

  if (index === -1) {
    return {
      success: false,

      message: "Scheduled block not found.",
    };
  }

  const scheduledBlock = scheduledBlocks[index];

  /*
   * Remove active DNR rule.
   */

  if (scheduledBlock.active) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [scheduledBlock.ruleId],
    });
  }

  /*
   * Remove schedule alarm.
   */

  await chrome.alarms.clear(`schedule:${scheduledBlock.id}`);

  /*
   * Remove from storage.
   */

  scheduledBlocks.splice(index, 1);

  await saveScheduledBlocks(scheduledBlocks);

  console.log("Scheduled block removed:", scheduledBlock.domain);

  return {
    success: true,

    message: `${scheduledBlock.domain} schedule removed.`,
  };
}

/*
 * ------------------------------------------------------------
 * Browser startup recovery
 * ------------------------------------------------------------
 */

chrome.runtime.onStartup.addListener(async () => {
  console.log("Browser started. Restoring FocusGuard...");

  try {
    /*
     * Clean expired temporary blocks.
     */

    await cleanupExpiredBlocks();

    /*
     * Restore temporary alarms.
     */

    await restoreAlarms();

    /*
     * Restore scheduled blocks.
     */

    await restoreScheduledBlocks();

    console.log("Browser startup recovery completed.");
  } catch (error) {
    console.error("Browser startup recovery failed:", error);
  }
});
