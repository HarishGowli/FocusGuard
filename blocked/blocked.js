const websiteName = document.getElementById("websiteName");

const countdown = document.getElementById("countdown");

const countdownSection = document.getElementById("countdownSection");

const scheduleSection = document.getElementById("scheduleSection");

const scheduleInfo = document.getElementById("scheduleInfo");

const status = document.getElementById("status");

const backButton = document.getElementById("backButton");

/*
 * Get data from URL parameters.
 *
 * Example for temporary:
 * blocked.html?domain=youtube.com&expiresAt=123456
 *
 * Example for scheduled:
 * blocked.html?domain=youtube.com&scheduled=true
 */

const params = new URLSearchParams(window.location.search);

const domain = params.get("domain");

const expiresAt = Number(params.get("expiresAt"));

const scheduled = params.get("scheduled") === "true";

if (domain) {
  websiteName.textContent = domain;
}

/*
 * Format milliseconds
 * into HH:MM:SS
 */

function formatTime(milliseconds) {
  if (milliseconds <= 0) {
    return "00:00:00";
  }

  const totalSeconds = Math.ceil(milliseconds / 1000);

  const hours = Math.floor(totalSeconds / 3600);

  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const seconds = totalSeconds % 60;

  return [
    String(hours).padStart(2, "0"),

    String(minutes).padStart(2, "0"),

    String(seconds).padStart(2, "0"),
  ].join(":");
}

/*
 * Update countdown
 */

function updateCountdown() {
  const remaining = expiresAt - Date.now();

  if (remaining <= 0) {
    countdown.textContent = "00:00:00";

    status.textContent = "Your focus session has ended.";

    return;
  }

  countdown.textContent = formatTime(remaining);
}

/*
 * Calculate end time for active scheduled block
 */

function calculateScheduledEndTime(schedule) {
  const now = new Date();

  const currentDay = now.getDay();

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const startMinutes = timeToMinutes(schedule.startTime);

  const endMinutes = timeToMinutes(schedule.endTime);

  /*
   * Normal schedule (end > start)
   */
  if (endMinutes > startMinutes) {
    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      const endDate = new Date(now);

      endDate.setHours(
        Number(schedule.endTime.split(":")[0]),
        Number(schedule.endTime.split(":")[1]),
        0,
        0,
      );

      return endDate.getTime();
    }

    return null;
  }

  /*
   * Overnight schedule (start > end)
   */
  if (currentMinutes >= startMinutes) {
    /*
     * After start time, goes to next day
     */
    const endDate = new Date(now);

    endDate.setDate(endDate.getDate() + 1);

    endDate.setHours(
      Number(schedule.endTime.split(":")[0]),
      Number(schedule.endTime.split(":")[1]),
      0,
      0,
    );

    return endDate.getTime();
  }

  if (currentMinutes < endMinutes) {
    /*
     * Early morning, belongs to previous day's schedule
     */
    const endDate = new Date(now);

    endDate.setHours(
      Number(schedule.endTime.split(":")[0]),
      Number(schedule.endTime.split(":")[1]),
      0,
      0,
    );

    return endDate.getTime();
  }

  return null;
}

/*
 * Helper function - convert time to minutes
 */

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

/*
 * Load schedule information from storage
 */

async function loadScheduleInfoAndCountdown() {
  if (!scheduled || !domain) {
    return;
  }

  try {
    const result = await chrome.storage.local.get(["scheduledBlocks"]);

    const scheduledBlocks = result.scheduledBlocks || [];

    const schedule = scheduledBlocks.find((item) => item.domain === domain);

    if (!schedule) {
      scheduleInfo.textContent = "Schedule information not available.";

      countdownSection.classList.add("hidden");

      return;
    }

    /*
     * Check if schedule is currently active
     */
    const dayNames = {
      0: "Sunday",

      1: "Monday",

      2: "Tuesday",

      3: "Wednesday",

      4: "Thursday",

      5: "Friday",

      6: "Saturday",
    };

    const days = schedule.schedule.days.map((day) => dayNames[day]).join(", ");

    scheduleInfo.innerHTML = `

            <div class="schedule-detail">
                <span class="schedule-label">Days:</span>
                <span class="schedule-value">${days}</span>
            </div>

            <div class="schedule-detail">
                <span class="schedule-label">Time:</span>
                <span class="schedule-value">
                    ${schedule.schedule.startTime}
                    →
                    ${schedule.schedule.endTime}
                </span>
            </div>

        `;

    /*
     * Calculate end time for countdown
     */
    const endTime = calculateScheduledEndTime(schedule.schedule);

    if (endTime) {
      /*
       * Schedule is active - show countdown
       */
      countdownSection.classList.remove("hidden");

      const remaining = endTime - Date.now();

      if (remaining > 0) {
        countdown.textContent = formatTime(remaining);

        status.textContent = "This website is blocked on a schedule.";

        /*
         * Update countdown every second
         */
        setInterval(() => {
          const newRemaining = endTime - Date.now();

          if (newRemaining <= 0) {
            countdown.textContent = "00:00:00";

            status.textContent = "Schedule has ended.";

            /*
             * Reload the page to show unblocked state
             */
            setTimeout(() => {
              window.location.reload();
            }, 2000);

            return;
          }

          countdown.textContent = formatTime(newRemaining);
        }, 1000);
      } else {
        countdown.textContent = "00:00:00";

        status.textContent = "Schedule has ended.";
      }
    } else {
      /*
       * Schedule is not active
       */
      countdownSection.classList.add("hidden");

      status.textContent = "This schedule is not currently active.";
    }
  } catch (error) {
    console.error("Failed to load schedule info:", error);

    scheduleInfo.textContent = "Unable to load schedule information.";

    countdownSection.classList.add("hidden");
  }
}

/*
 * Initialize page based on block type
 */

if (scheduled) {
  /*
   * Scheduled block - show schedule info and countdown if active
   */

  scheduleSection.classList.remove("hidden");

  status.textContent = "Loading schedule information...";

  loadScheduleInfoAndCountdown();
} else if (expiresAt) {
  /*
   * Temporary block - show countdown
   */

  countdownSection.classList.remove("hidden");

  scheduleSection.classList.add("hidden");

  updateCountdown();

  setInterval(updateCountdown, 1000);
} else {
  /*
   * Fallback - no parameters
   */

  countdownSection.classList.add("hidden");

  scheduleSection.classList.add("hidden");

  status.textContent = "This website is blocked.";
}

/*
 * Go back
 */

backButton.addEventListener("click", () => {
  history.back();
});
